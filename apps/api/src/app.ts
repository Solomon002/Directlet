import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { healthResponseSchema } from "@directlet/shared";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/routes";

export const app = express();

// Tokens must never be cached by a browser or a proxy.
function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  next();
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  const body = healthResponseSchema.parse({
    status: "ok",
    service: "directlet-api",
  });
  res.json(body);
});

app.use("/auth", noStore, authRouter);

// These two must stay last, after every route.
app.use(notFoundHandler);
app.use(errorHandler);
