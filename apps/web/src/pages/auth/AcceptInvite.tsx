import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { getInviteInfo, acceptInvite } from "../../lib/session";
import { parseApiError } from "../../lib/errors";
import { homePathFor } from "../../lib/roles";
import { useAuthStore } from "../../stores/authStore";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const [info, setInfo] = useState<{ email: string; fullName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const data = await getInviteInfo(token);
        setInfo(data);
      } catch (err) {
        setLoadError(parseApiError(err).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (status === "authenticated" && user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const loggedInUser = await acceptInvite(token, password);
      navigate(homePathFor(loggedInUser.role), { replace: true });
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-4 sm:p-8 text-ink">Loading...</div>;
  }

  if (loadError || !info) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="font-display text-2xl font-extrabold text-night-blue">Invite not available</h1>
        <p className="mt-2 text-sm font-bold text-red-600">{loadError ?? "This invite link is invalid."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Welcome, {info.fullName}</h1>
      <p className="mt-1 text-sm text-ink">Set a password for {info.email} to finish setting up your account.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
          />
        </label>

        {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
        >
          {submitting ? "Setting up..." : "Set password and continue"}
        </button>
      </form>
    </div>
  );
}
