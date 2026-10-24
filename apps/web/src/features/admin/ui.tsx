import type { ReactNode } from "react";

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "alert" | "good" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-ink/60">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-extrabold ${
          tone === "alert" ? "text-red-600" : tone === "good" ? "text-direct-green" : "text-night-blue"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-ink/70">{note}</p>}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold text-night-blue">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// A plain bar chart: one bar per day, hover a bar for its exact value.
export function DailyBars({
  points,
  color = "bg-trust-blue",
  unit,
}: {
  points: { day: string; value: number }[];
  color?: string;
  unit: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex h-32 items-end gap-[3px]">
        {points.map((p) => (
          <div
            key={p.day}
            title={`${new Date(p.day).toDateString()}: ${p.value} ${unit}`}
            className="flex h-full flex-1 items-end"
          >
            <div className={`w-full rounded-t ${color}`} style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-ink/60">
        <span>{points[0] && new Date(points[0].day).toLocaleDateString([], { day: "numeric", month: "short" })}</span>
        <span>
          {total} {unit} in 30 days
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink">
      <span>
        {total} result{total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="font-bold text-trust-blue disabled:text-ink/30"
        >
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="font-bold text-trust-blue disabled:text-ink/30"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "-";
}

export function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} days ago` : formatDate(iso);
}
