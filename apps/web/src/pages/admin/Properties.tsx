import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { hideProperty, listProperties, unhideProperty, type AdminPropertyRow, type Paged } from "../../features/admin/api";
import { Pager, formatDate } from "../../features/admin/ui";
import { parseApiError } from "../../lib/errors";

function visibility(p: AdminPropertyRow) {
  if (p.hiddenByAdminAt) return { text: "Taken down", className: "font-bold text-red-600" };
  if (p.landlord.suspendedAt) return { text: "Owner suspended", className: "font-bold text-red-600" };
  if (!p.isPublic) return { text: "Hidden by owner", className: "text-ink/60" };
  return { text: "Live", className: "font-bold text-direct-green" };
}

export default function Properties() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const hidden = params.get("hidden") === "true";
  const page = Number(params.get("page") ?? 1) || 1;

  const [draft, setDraft] = useState(q);
  const [data, setData] = useState<Paged<"properties", AdminPropertyRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    listProperties({ q: q || undefined, hidden, page })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => setError(parseApiError(err).message));
  }, [q, hidden, page, reload]);

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

  async function handleHide(p: AdminPropertyRow) {
    const reason = window.prompt(
      `Take down "${p.name}" from the marketplace? The owner cannot re-list it until you restore it.\n\nReason (kept on record):`,
    );
    if (reason === null) return;
    setActingOn(p.id);
    try {
      await hideProperty(p.id, reason.trim() || undefined);
      setReload((n) => n + 1);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setActingOn(null);
    }
  }

  async function handleUnhide(p: AdminPropertyRow) {
    setActingOn(p.id);
    try {
      await unhideProperty(p.id);
      setReload((n) => n + 1);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Properties</h1>
      <p className="mt-1 text-sm text-ink/70">Every compound from every landlord. Take down any listing that looks fake or abusive.</p>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search name, area, city or owner"
          className="min-w-0 flex-1 rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink"
        />
        <button type="submit" className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white">
          Search
        </button>
      </form>
      <button
        type="button"
        onClick={() => update({ hidden: hidden ? null : "true" })}
        className={`mt-3 rounded-full px-3 py-1 text-sm font-bold ${hidden ? "bg-red-600 text-white" : "bg-white text-ink"}`}
      >
        Taken down only
      </button>

      {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
      {!data && !error && <p className="mt-4 text-ink">Loading...</p>}

      {data && (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-mist text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Flats</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3">On marketplace</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {data.properties.map((p) => {
                  const status = visibility(p);
                  return (
                    <tr key={p.id} className="align-top hover:bg-mist/40">
                      <td className="px-4 py-3">
                        {p.visibleToPublic ? (
                          <Link to={`/compounds/${p.id}`} className="font-bold text-night-blue hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-night-blue">{p.name}</span>
                        )}
                        <p className="text-xs text-ink/60">
                          {p.area}, {p.city}
                          {p.hasMapPin ? "" : " · no map pin"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/users/${p.landlord.id}`} className="text-trust-blue hover:underline">
                          {p.landlord.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {p.occupiedUnits} / {p.units} let
                      </td>
                      <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={status.className}>{status.text}</span>
                        {p.hiddenByAdminReason && <p className="text-xs text-ink/60">{p.hiddenByAdminReason}</p>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.hiddenByAdminAt ? (
                          <button
                            type="button"
                            disabled={actingOn === p.id}
                            onClick={() => void handleUnhide(p)}
                            className="font-bold text-direct-green hover:underline disabled:opacity-60"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actingOn === p.id}
                            onClick={() => void handleHide(p)}
                            className="font-bold text-red-600 hover:underline disabled:opacity-60"
                          >
                            Take down
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data.properties.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink/60">
                      No properties match.
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
