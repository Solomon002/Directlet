import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { register } from "../../lib/session";
import { parseApiError } from "../../lib/errors";
import { homePathFor } from "../../lib/roles";
import { useAuthStore } from "../../stores/authStore";

export default function Register() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Set when a visitor tapped "Message landlord" and was sent here to sign up.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  // Most people signing up are looking for a home; landlords pick the other tab.
  const [accountType, setAccountType] = useState<"HUNTER" | "LANDLORD">(
    searchParams.get("as") === "landlord" ? "LANDLORD" : "HUNTER",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (status === "authenticated" && user) {
    return <Navigate to={from ?? homePathFor(user.role)} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const newUser = await register({
        fullName,
        email,
        password,
        phone: phone || undefined,
        accountType,
      });
      navigate(from ?? homePathFor(newUser.role), { replace: true });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Sign up</h1>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white p-1 shadow-sm">
        {(
          [
            ["HUNTER", "I'm looking for a home"],
            ["LANDLORD", "I'm a landlord"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            onClick={() => setAccountType(value)}
            className={`rounded-lg px-3 py-2 text-sm font-bold ${
              accountType === value ? "bg-trust-blue text-white" : "text-ink"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink">
        {accountType === "HUNTER"
          ? "Message landlords directly and keep your chats in one place. No agent fees."
          : "List your compounds free, manage tenants, rent and complaints."}
      </p>
      <p className="mt-1 text-xs text-ink/60">Renting already? Your landlord sends you an invite link instead.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Full name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
          />
          {fieldErrors.fullName && (
            <span className="text-xs font-normal text-red-600">{fieldErrors.fullName[0]}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
          />
          {fieldErrors.email && (
            <span className="text-xs font-normal text-red-600">{fieldErrors.email[0]}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Phone <span className="font-normal text-ink/60">(optional)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
          />
          {fieldErrors.phone && (
            <span className="text-xs font-normal text-red-600">{fieldErrors.phone[0]}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
          />
          {fieldErrors.password && (
            <span className="text-xs font-normal text-red-600">{fieldErrors.password[0]}</span>
          )}
        </label>

        {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-ink">
        Already have an account?{" "}
        <Link to="/login" state={location.state} className="font-bold text-trust-blue">
          Log in
        </Link>
      </p>
    </div>
  );
}
