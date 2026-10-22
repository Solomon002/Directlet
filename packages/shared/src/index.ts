import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export * from "./schemas/auth";
export * from "./schemas/property";
export * from "./schemas/unit";
export * from "./schemas/tenancy";
export * from "./schemas/payment";
