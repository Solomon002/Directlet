import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { verifyEmail } from "../../features/trust/api";
import { refreshSession } from "../../lib/session";
import { parseApiError } from "../../lib/errors";

// Where the link in the confirmation email lands.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"working" | "done" | "failed">(token ? "working" : "failed");
  const [message, setMessage] = useState<string | null>(token ? null : "This link is missing its code. Open the link from your email again.");

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      // The signed-in user (if any) now has a confirmed address; pick that up so the banner goes.
      .then(() => refreshSession())
      .then(() => setState("done"))
      .catch((err: unknown) => {
        setMessage(parseApiError(err).message);
        setState("failed");
      });
  }, [token]);

  return (
    <div className="mx-auto max-w-md p-6 sm:p-10">
      {state === "working" && <p className="text-ink">Confirming your email...</p>}
      {state === "done" && (
        <>
          <h1 className="font-display text-3xl font-extrabold text-night-blue">Email confirmed</h1>
          <p className="mt-2 text-ink">Thank you. You can now request viewings.</p>
          <Link to="/compounds" className="mt-6 inline-block rounded-lg bg-trust-blue px-5 py-3 font-display font-extrabold text-white">
            Browse listings
          </Link>
        </>
      )}
      {state === "failed" && (
        <>
          <h1 className="font-display text-3xl font-extrabold text-night-blue">We could not confirm that</h1>
          <p role="alert" className="mt-2 text-ink">
            {message}
          </p>
          <p className="mt-4 text-sm text-ink">
            Log in and use "Send it again" to get a fresh link.{" "}
            <Link to="/login" className="font-bold text-trust-blue hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
