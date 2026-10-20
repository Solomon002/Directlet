import type { Request, Response } from "express";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import * as authService from "./service";

const REFRESH_COOKIE = "directlet_refresh";

// httpOnly: page scripts cannot read it. Strict: never sent from another site.
// path: only sent to the auth routes, not on every API call.
const cookieBase = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/auth",
} as const;

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieBase, expires: expiresAt });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieBase);
}

function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function register(req: Request, res: Response) {
  const { user, accessToken, refreshToken, refreshExpiresAt } =
    await authService.registerLandlord(req.body);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.status(201).json({ user, accessToken });
}

export async function login(req: Request, res: Response) {
  const { user, accessToken, refreshToken, refreshExpiresAt } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.status(200).json({ user, accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = readRefreshCookie(req);
  if (!token) {
    throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
  }

  try {
    const { user, accessToken, refreshToken, refreshExpiresAt } =
      await authService.rotateRefreshToken(token);
    setRefreshCookie(res, refreshToken, refreshExpiresAt);
    res.status(200).json({ user, accessToken });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) {
      clearRefreshCookie(res);
    }
    throw error;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
}
