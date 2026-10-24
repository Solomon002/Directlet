import type { NextFunction, Request, Response } from "express";
import { waitUntil } from "@vercel/functions";
import { prisma } from "../lib/prisma";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Ids and tokens (invite tokens are UUIDs too) are replaced with :id, so the
// stored path is a route pattern and never contains a secret.
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{20,})$/i;

// "properties" -> "property", "payments" -> "payment", to match response keys.
function singular(segment: string) {
  if (segment.endsWith("ies")) return segment.slice(0, -3) + "y";
  if (segment.endsWith("s")) return segment.slice(0, -1);
  return segment;
}

function describePath(originalUrl: string) {
  const segments = originalUrl.split("?")[0].split("/").filter(Boolean);
  let entity: string | null = null;
  let entityId: string | null = null;

  const pattern = segments.map((segment, index) => {
    if (!ID_SEGMENT.test(segment)) return segment;
    if (!entityId && segments[0] !== "auth") {
      entity = index > 0 ? singular(segments[index - 1]) : null;
      entityId = segment;
    }
    return ":id";
  });

  return { path: "/" + pattern.join("/"), entity, entityId };
}

// Picks the created record out of responses shaped like { complaint: { id } }.
function createdRecord(body: unknown): { entity: string; entityId: string } | null {
  if (typeof body !== "object" || body === null) return null;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string") {
      return { entity: key, entityId: (value as { id: string }).id };
    }
  }
  return null;
}

export function auditLog(req: Request, res: Response, next: NextFunction) {
  // Page-view counting is not an action anyone took; it has its own table.
  if (!STATE_CHANGING_METHODS.has(req.method) || req.originalUrl.startsWith("/analytics")) {
    next();
    return;
  }

  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  // Online, the function can be frozen the moment the response is sent. This
  // asks the platform to keep it alive until the log row is written. Locally
  // it does nothing.
  let release: () => void = () => undefined;
  waitUntil(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  // A request that dies before it finishes has nothing to record.
  res.on("close", () => {
    if (!res.writableFinished) release();
  });

  res.on("finish", () => {
    const { path, entity, entityId } = describePath(req.originalUrl);
    const created = !entityId && res.statusCode < 300 && !path.startsWith("/auth") ? createdRecord(responseBody) : null;
    // Login, sign-up and invite acceptance have no signed-in user yet; the
    // user they produced is in the response.
    const authUserId =
      path.startsWith("/auth") && res.statusCode < 300
        ? ((responseBody as { user?: { id?: unknown } } | undefined)?.user?.id as string | undefined)
        : undefined;

    prisma.auditLog
      .create({
        data: {
          userId: req.user?.sub ?? (typeof authUserId === "string" ? authUserId : null),
          method: req.method,
          path,
          statusCode: res.statusCode,
          entity: created?.entity ?? entity,
          entityId: created?.entityId ?? entityId,
          ip: req.ip ?? null,
        },
      })
      .catch((error: unknown) => {
        console.error("Failed to write audit log", error);
      })
      .finally(release);
  });

  next();
}
