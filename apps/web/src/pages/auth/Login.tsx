import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { login } from "../../lib/session";
import { parseApiError } from "../../lib/errors";
import { homePathFor } from "../../lib/roles";
import { useAuthStore } from "../../stores/authStore";
import Brand from "../../features/nav/Brand";

// Demo accounts for testers. The passwords are not kept in the code: set
// VITE_DEMO_LANDLORD_PASSWORD and VITE_DEMO_TENANT_PASSWORD where the site is built
// (e.g. in Vercel) to show them here and fill them in with one tap. Without them the
// box still lists the emails.
const DEMO_ACCOUNTS = [
  {
    role: "Landlord",
    email: "demo@directlet.ng",
    password: import.meta.env.VITE_DEMO_LANDLORD_PASSWORD as string | undefined,
  },
  {
    role: "Tenant",
    email: "demo.tenant@directlet.ng",
    password: import.meta.env.VITE_DEMO_TENANT_PASSWORD as string | undefined,
  },
];

const INPUT_CLASS =
  "w-full rounded-lg border border-mist bg-white p-3 font-sans text-ink placeholder:text-ink/40 transition focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue";

export default function Login() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  if (status === "authenticated" && user) {
    return <Navigate to={from ?? homePathFor(user.role)} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const loggedInUser = await login(email, password);
      navigate(from ?? homePathFor(loggedInUser.role), { replace: true });
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-4.0625rem)] bg-white lg:grid-cols-2">
      {/* Brand panel: larger screens. Phones already have the logo in the header. */}
      <aside className="hidden flex-col items-center justify-center gap-4 bg-night-blue p-12 text-center lg:flex">
        <Brand to="/" tone="light" />
        <p className="font-display text-3xl font-extrabold text-white">No Agent Wahala.</p>
        <p className="max-w-xs font-sans text-sm text-white/70">
          Find a home, pay rent and manage your property, directly. No middleman.
        </p>
      </aside>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8 sm:py-14">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-extrabold text-night-blue sm:text-4xl">Log in</h1>
          <p className="mt-2 font-sans text-sm text-ink/70">Welcome back. Enter your details to continue.</p>

          <div className="mt-6 rounded-lg bg-gray-100 p-3 font-sans text-xs text-gray-600">
            <p className="font-bold uppercase tracking-wide text-gray-500">Demo accounts</p>
            <ul className="mt-2 flex flex-col gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.role} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-bold text-gray-700">{account.role}:</span>{" "}
                    <span className="break-all">
                      {account.email}
                      {account.password ? ` / ${account.password}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password ?? "");
                    }}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 font-bold text-trust-blue transition hover:bg-gray-50"
                  >
                    Fill
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block font-sans text-sm font-bold text-ink">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block font-sans text-sm font-bold text-ink">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>

            {formError && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 font-sans text-sm font-bold text-red-600">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-trust-blue px-5 py-3 font-display font-extrabold text-white shadow-sm transition-colors duration-200 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-trust-blue focus:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center font-sans text-sm text-ink">
            Need an account?{" "}
            <Link to="/register" state={location.state} className="font-bold text-trust-blue hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
