import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { listUsers, roleNames, type AdminUserRow, type Paged } from "../../features/admin/api";
import { Pager, formatDate, timeAgo } from "../../features/admin/ui";
import { parseApiError } from "../../lib/errors";

const roleFilters = [
  ["", "Everyone"],
  ["LANDLORD", "Landlords"],
  ["HUNTER", "House hunters"],
  ["TENANT", "Tenants"],
  ["ADMIN", "Admins"],
] as const;

export default function Users() {
  // Filters live in the URL, so the back button and shared links keep them.
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const role = params.get("role") ?? "";
  const suspended = params.get("suspended") === "true";
  const page = Number(params.get("page") ?? 1) || 1;

  const [draft, setDraft] = useState(q);
  const [data, setData] = useState<Paged<"users", AdminUserRow> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUsers({ q: q || undefined, role: role || undefined, suspended, page })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => setError(parseApiError(err).message));
  }, [q, role, suspended, page]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    update({ q: draft.trim() || null });
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Users</h1>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search name, email or phone"
          className="min-w-0 flex-1 rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink"
        />
        <button type="submit" className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white">
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {roleFilters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => update({ role: value || null })}
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              role === value ? "bg-trust-blue text-white" : "bg-white text-ink"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => update({ suspended: suspended ? null : "true" })}
          className={`rounded-full px-3 py-1 text-sm font-bold ${suspended ? "bg-red-600 text-white" : "bg-white text-ink"}`}
        >
          Suspended only
        </button>
      </div>

      {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
      {!data && !error && <p className="mt-4 text-ink">Loading...</p>}

      {data && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-mist text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3">Owns / rents</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {data.users.map((user) => (
                  <tr key={user.id} className="hover:bg-mist/40">
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${user.id}`} className="font-bold text-night-blue hover:underline">
                        {user.fullName}
                      </Link>
                      <p className="text-xs text-ink/60">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">{roleNames[user.role]}</td>
                    <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">{timeAgo(user.lastActiveAt)}</td>
                    <td className="px-4 py-3">
                      {user.role === "LANDLORD"
                        ? `${user.properties} propert${user.properties === 1 ? "y" : "ies"}`
                        : user.role === "TENANT"
                          ? `${user.tenancies} tenanc${user.tenancies === 1 ? "y" : "ies"}`
                          : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {user.suspendedAt ? (
                        <span className="font-bold text-red-600">Suspended</span>
                      ) : !user.activated ? (
                        <span className="text-ink/60">Invite not accepted</span>
                      ) : (
                        <span className="text-direct-green">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink/60">
                      No users match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
