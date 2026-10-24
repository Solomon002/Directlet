import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { startConversation } from "./api";
import { useAuthStore } from "../../stores/authStore";
import { messagesPathFor } from "../../lib/roles";
import { parseApiError } from "../../lib/errors";

// A button that opens a short message box and starts (or continues) a chat,
// then jumps to the thread. Signed-out visitors are sent to sign up first and
// brought back here afterwards.
export default function StartConversation({
  target,
  buttonLabel,
  initialText,
  variant = "link",
}: {
  target: { propertyId?: string; unitId?: string; tenancyId?: string };
  buttonLabel: string;
  initialText: string;
  // "button" is the solid brand button used on listing cards.
  variant?: "link" | "button";
}) {
  const triggerClass =
    variant === "button"
      ? "inline-block rounded-xl bg-trust-blue px-4 py-2 font-display text-sm font-extrabold text-white"
      : "text-sm font-bold text-trust-blue hover:underline";
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(initialText);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <Link
        to="/register?as=hunter"
        state={{ from: location }}
        className={triggerClass}
      >
        {buttonLabel}
      </Link>
    );
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSending(true);
    setError(null);
    try {
      const conversation = await startConversation({ ...target, body });
      navigate(`${messagesPathFor(user.role)}/${conversation.id}`);
    } catch (err) {
      setError(parseApiError(err).message);
      setSending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        {open ? "Cancel" : buttonLabel}
      </button>
      {open && (
        <form onSubmit={handleSend} className="mt-3 flex max-w-sm flex-col gap-2 rounded-xl bg-mist p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={3}
            maxLength={2000}
            className="rounded-lg border border-mist bg-white px-3 py-2 font-sans text-sm text-ink"
          />
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-xl bg-trust-blue px-5 py-2 font-display font-extrabold text-white disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
