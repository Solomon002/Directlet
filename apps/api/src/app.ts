import express from "express";
import cors from "cors";
import { healthResponseSchema } from "@tenora/shared";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  const body = healthResponseSchema.parse({
    status: "ok",
    service: "tenora-api",
  });
  res.json(body);
});