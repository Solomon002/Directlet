import { useState } from "react";
import { resendConfirmation } from "./api";
import { parseApiError } from "../../lib/errors";
import { useAuthStore } from "../../stores/authStore";

// Shown to a signed-in person whose email address is not confirmed yet (and only when
// the site can actually send the email). Landlords are asked to trust strangers, so a
// stranger's email has to be real.
export default function ConfirmEmail({ compact = false }: { compact?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!user?.needsEmailConfirmation) return null;

  async function handleResend() {
    setState("sending");
    setError(null);
    try {
      await resendConfirmation();
      setState("sent");
    } catch (err) {
      setError(parseApiError(err).message);
      setState("idle");
    }
  }

  return (
    <div className={`rounded-xl border-l-4 border-amber-500 bg-white p-3 text-sm text-ink shadow-sm ${compact ? "" : "mx-4 mt-4 sm:mx-8"}`}>
      <p>
        <span className="font-bold text-night-blue">Confirm your email.</span> We sent a link to {user.email}. Open it to
        request viewings. Check your spam folder too.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={state !== "idle"}
          onClick={() => void handleResend()}
          className="font-bold text-trust-blue hover:underline disabled:opacity-60"
        >
          {state === "sending" ? "Sending..." : state === "sent" ? "Sent. Check your inbox" : "Send it again"}
        </button>
        {error && (
          <span role="alert" className="font-bold text-red-600">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
