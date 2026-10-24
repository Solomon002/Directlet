import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { listActivity, roleNames, type AdminActivityEntry, type Paged } from "../../features/admin/api";
import { describeActivity } from "../../features/dashboard/api";
import { Pager, timeAgo } from "../../features/admin/ui";
import { parseApiError } from "../../lib/errors";

// Every state-changing request on the platform, newest first.
export default function Activity() {
  const [params, setParams] = useSearchParams();
  const userId = params.get("userId") ?? "";
  const failed = params.get("failed") === "true";
  const page = Number(params.get("page") ?? 1) || 1;

  const [data, setData] = useState<Paged<"entries", AdminActivityEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listActivity({ userId: userId || undefined, failed, page })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => setError(parseApiError(err).message));
  }, [userId, failed, page]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Activity</h1>
      <p className="mt-1 text-sm text-ink/70">
        Every change anyone made, including failed attempts. Message contents and passwords are never recorded.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => update({ failed: failed ? null : "true" })}
          className={`rounded-full px-3 py-1 text-sm font-bold ${failed ? "bg-red-600 text-white" : "bg-white text-ink"}`}
        >
          Failed only (errors, blocked attempts)
        </button>
        {userId && (
          <button
            type="button"
            onClick={() => update({ userId: null })}
            className="rounded-full bg-trust-blue px-3 py-1 text-sm font-bold text-white"
          >
            One user only (clear)
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
      {!data && !error && <p className="mt-4 text-ink">Loading...</p>}

      {data && (
        <>
          <ul className="mt-4 divide-y divide-mist rounded-xl bg-white text-sm shadow-sm">
            {data.entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span>
                  {entry.user ? (
                    <Link to={`/admin/users/${entry.user.id}`} className="font-bold text-night-blue hover:underline">
                      {entry.user.fullName}
                    </Link>
                  ) : (
                    <span className="font-bold text-ink/60">Visitor (not signed in)</span>
                  )}
                  {entry.user && <span className="text-xs text-ink/60"> · {roleNames[entry.user.role]}</span>}{" "}
                  {describeActivity({ ...entry, user: null })}
                </span>
                <span className={`text-xs ${entry.statusCode >= 400 ? "font-bold text-red-600" : "text-ink/60"}`}>
                  {entry.statusCode >= 400 ? `Failed (${entry.statusCode}) · ` : ""}
                  {timeAgo(entry.createdAt)}
                </span>
              </li>
            ))}
            {data.entries.length === 0 && <li className="px-4 py-6 text-center text-ink/60">Nothing here.</li>}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
