import express from "express";
import cors from "cors";
import helmet from "helmet";
import { healthResponseSchema } from "@directlet/shared";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  const body = healthResponseSchema.parse({
    status: "ok",
    service: "directlet-api",
  });
  res.json(body);
});

// These two must stay last, after every route.
app.use(notFoundHandler);
app.use(errorHandler);
