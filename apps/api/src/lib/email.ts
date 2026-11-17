import { waitUntil } from "@vercel/functions";
import { env } from "../config/env";

// True once a Resend key is set. Features that depend on someone actually receiving
// an email (like confirming an address) only switch on when this is true.
export const emailEnabled = Boolean(env.RESEND_API_KEY);

type Email = { to: string; subject: string; text: string };

// Sends one email. With no key it only logs, so development and tests need no account.
// It never throws: a mail problem must not break the thing the person was doing.
export async function sendEmail({ to, subject, text }: Email): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email not sent: no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return false;
  }

  try {
    const res = await fetch(env.RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`Email to ${to} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email request failed", error);
    return false;
  }
}

// Runs a send after the response has gone. Online the function can be frozen the
// moment it replies, so waitUntil keeps it alive until the email is out.
export function sendInBackground(email: Email) {
  waitUntil(sendEmail(email));
}
