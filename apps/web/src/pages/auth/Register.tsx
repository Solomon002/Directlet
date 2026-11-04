import { useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router";
import { register } from "../../lib/session";
import { parseApiError } from "../../lib/errors";
import { homePathFor } from "../../lib/roles";
import { useAuthStore } from "../../stores/authStore";
import Brand from "../../features/nav/Brand";

const INPUT_CLASS =
  "w-full rounded-lg border border-mist bg-white p-3 font-sans text-ink placeholder:text-ink/40 transition focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue";

export default function Register() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const from = (location.state as { from?: { pathname: string } } | null)?.from
    ?.pathname;

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
    <div className="min-h-screen bg-mist/30 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="flex justify-center mb-6">
          <Brand />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-night-blue">
          Create an account
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Join DirectLet to find a home or manage your properties.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-mist">
          {/* Toggle Switch */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-mist/50 p-1">
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
                className={`rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                  accountType === value
                    ? "bg-white text-trust-blue shadow-sm"
                    : "text-ink/60 hover:text-ink"
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          <p className="text-sm text-ink mb-1">
            {accountType === "HUNTER"
              ? "Message owners directly and keep your chats in one place. No agent fees."
              : "List your compounds free, manage tenants, rent and complaints."}
          </p>
          <p className="text-xs text-ink/60 mb-6">
            Renting already? Your landlord sends you an invite link instead.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={INPUT_CLASS}
              />
              {fieldErrors.fullName && (
                <span className="text-xs font-normal text-red-600">
                  {fieldErrors.fullName[0]}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={INPUT_CLASS}
              />
              {fieldErrors.email && (
                <span className="text-xs font-normal text-red-600">
                  {fieldErrors.email[0]}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
              Phone <span className="font-normal text-ink/60">(optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
              />
              {fieldErrors.phone && (
                <span className="text-xs font-normal text-red-600">
                  {fieldErrors.phone[0]}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={INPUT_CLASS}
              />
              {fieldErrors.password && (
                <span className="text-xs font-normal text-red-600">
                  {fieldErrors.password[0]}
                </span>
              )}
            </label>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-bold text-red-600">{formError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white transition hover:bg-[#133c82] disabled:opacity-60 shadow-sm"
            >
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink/70">
            Already have an account?{" "}
            <Link
              to="/login"
              state={location.state}
              className="font-bold text-trust-blue hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
