import { env } from "../config/env";
import { AppError } from "../utils/AppError";

// The "select all images with..." check on sign-up, by hCaptcha. It is on only when
// both keys are set, so the site works without it (and tests need no account).
const enabled = Boolean(env.HCAPTCHA_SECRET && env.HCAPTCHA_SITEKEY);

// The public key the sign-up page uses to show the check, or null when it is off.
export const captchaSiteKey: string | null = enabled ? (env.HCAPTCHA_SITEKEY ?? null) : null;

// Asks hCaptcha whether the person really passed the check. Fails closed: if the
// answer is wrong, missing, or hCaptcha cannot be reached, the sign-up does not go through.
export async function requireHuman(token: string | undefined, ip: string | undefined) {
  if (!enabled) return;

  if (!token) {
    throw new AppError(400, "Please complete the check that shows you are not a robot.", "CAPTCHA_REQUIRED");
  }

  let success = false;
  try {
    const res = await fetch(env.HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.HCAPTCHA_SECRET!,
        response: token,
        sitekey: env.HCAPTCHA_SITEKEY!,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    success = res.ok && ((await res.json()) as { success?: boolean }).success === true;
  } catch (error) {
    console.error("Could not reach hCaptcha", error);
    throw new AppError(503, "We could not run the robot check just now. Please try again in a moment.", "CAPTCHA_UNAVAILABLE");
  }

  if (!success) {
    throw new AppError(400, "The robot check did not pass. Please try it again.", "CAPTCHA_FAILED");
  }
}
