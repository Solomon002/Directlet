import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z
      .string()
      .refine(
        (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "must be a postgresql:// connection string",
      ),
    WEB_ORIGIN: z.url().default("http://localhost:5173"),
    JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "must be at least 32 characters"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
    // The browser path the login cookie is limited to. Online, the API sits
    // under /api on the same address as the website, so it is /api/auth there.
    REFRESH_COOKIE_PATH: z.string().startsWith("/").default("/auth"),
    // How many proxies sit in front of the API (Vercel is 1), so the real
    // visitor IP is used for rate limits. 0 when running on a laptop.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    // Lets Vercel's scheduler call the rent roll job. Unset turns the route off.
    CRON_SECRET: z.string().min(16).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "must be different from JWT_ACCESS_SECRET",
      });
    }
    if (value.NODE_ENV === "production" && new URL(value.WEB_ORIGIN).protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        path: ["WEB_ORIGIN"],
        message: "must use https in production",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print only which variables are wrong, never their values (they can be secrets).
  console.error(
    "Invalid environment variables:",
    z.flattenError(parsed.error).fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
