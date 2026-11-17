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
    // Sends real emails through Resend (resend.com). Unset, emails are only written to
    // the log, and the "confirm your email" requirement is switched off, because nobody
    // could receive the confirmation link.
    RESEND_API_KEY: z.string().min(10).optional(),
    // Who emails come from. Resend's test sender only delivers to your own address; for
    // everyone, verify your domain in Resend and use an address on it.
    EMAIL_FROM: z.string().min(3).default("DirectLet <onboarding@resend.dev>"),
    // hCaptcha (hcaptcha.com), the "select the images that contain..." check on sign-up.
    // The check is on only when BOTH are set. The site key is public (the sign-up page
    // needs it); the secret never leaves the server.
    HCAPTCHA_SITEKEY: z.string().min(10).optional(),
    HCAPTCHA_SECRET: z.string().min(10).optional(),
    // Only for tests: points the check at a local stand-in.
    HCAPTCHA_VERIFY_URL: z.url().default("https://api.hcaptcha.com/siteverify"),
    // Only for tests: points email at a local stand-in so nothing real is sent.
    RESEND_API_URL: z.url().default("https://api.resend.com/emails"),
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
