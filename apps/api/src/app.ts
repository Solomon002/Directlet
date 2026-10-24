import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { healthResponseSchema } from "@directlet/shared";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { auditLog } from "./middleware/auditLog";
import { authRouter } from "./modules/auth/routes";
import { propertiesRouter } from "./modules/properties/routes";
import { publicRouter } from "./modules/public/routes";
import { tenanciesRouter } from "./modules/tenancies/routes";
import { paymentsRouter } from "./modules/payments/routes";
import { complaintsRouter } from "./modules/complaints/routes";
import { inspectionsRouter } from "./modules/inspections/routes";
import { dashboardRouter } from "./modules/dashboard/routes";
import { remindersRouter } from "./modules/reminders/routes";
import { conversationsRouter } from "./modules/conversations/routes";
import { analyticsRouter } from "./modules/analytics/routes";
import { adminRouter } from "./modules/admin/routes";

export const app = express();

function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  next();
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(auditLog);

app.get("/health", (_req, res) => {
  const body = healthResponseSchema.parse({
    status: "ok",
    service: "directlet-api",
  });
  res.json(body);
});

app.use("/auth", noStore, authRouter);
app.use("/properties", propertiesRouter);
app.use("/public", publicRouter);
app.use("/tenancies", tenanciesRouter);
app.use("/payments", paymentsRouter);
app.use("/complaints", complaintsRouter);
app.use("/inspections", inspectionsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/reminders", remindersRouter);
app.use("/conversations", noStore, conversationsRouter);
app.use("/analytics", analyticsRouter);
app.use("/admin", noStore, adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
