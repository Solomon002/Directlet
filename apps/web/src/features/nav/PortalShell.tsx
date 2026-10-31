import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { logout } from "../../lib/session";
import UnreadBadge from "../messages/UnreadBadge";
import { NavIcon, type IconName } from "./icons";

// The frame around the landlord, tenant and admin areas:
//   phones     a slim top bar, plus a tab bar fixed to the bottom of the screen
//   md and up  a sidebar that stays in view while the page scrolls
export type NavItem = {
  to: string;
  // For items that jump to a part of a long page, e.g. "#pay".
  hash?: string;
  label: string;
  icon: IconName;
  // Active only on exactly this page, not on pages below it.
  end?: boolean;
  badge?: number;
};

type Tone = "landlord" | "tenant" | "admin";

const TONE_BG: Record<Tone, string> = {
  landlord: "bg-night-blue",
  tenant: "bg-trust-blue",
  admin: "bg-ink",
};

function isActive(item: NavItem, items: NavItem[], pathname: string, hash: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (item.hash) return path === item.to && hash === item.hash;
  // "Home" is not active while one of its own jump links is the current spot.
  const hashTargetsHere = items.some((other) => other.hash && other.to === path && other.hash === hash);
  if (item.end) return path === item.to && !hashTargetsHere;
  return path === item.to || path.startsWith(`${item.to}/`);
}

// Moving between tabs starts at the top of the new page, and jump links scroll to
// their section. The section may not exist yet if its data is still loading, so
// it keeps looking for a couple of seconds.
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      const target = document.getElementById(hash.slice(1));
      if (target || ++tries > 20) {
        window.clearInterval(timer);
        target?.scrollIntoView({ block: "start" });
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [pathname, hash]);
}

// Tapping the tab you are already on does not change the address, so nothing else
// would happen. Like most apps, it scrolls back to that section, or to the top.
function scrollToItem(item: NavItem) {
  const target = item.hash ? document.getElementById(item.hash.slice(1)) : null;
  if (target) target.scrollIntoView({ block: "start" });
  else window.scrollTo({ top: 0 });
}

export default function PortalShell({
  tone,
  homePath,
  roleLabel,
  items,
  extraLink,
}: {
  tone: Tone;
  homePath: string;
  roleLabel: string;
  items: NavItem[];
  extraLink?: { to: string; label: string };
}) {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  useScrollOnNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  const bg = TONE_BG[tone];

  return (
    <div className="min-h-screen bg-mist md:flex">
      {/* Sidebar: larger screens */}
      <aside className={`hidden ${bg} text-white md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:justify-between md:px-3 md:py-8`}>
        <div>
          <Link to={homePath} className="block px-3 font-display text-lg font-extrabold">
            DirectLet
          </Link>
          <p className="px-3 text-xs font-bold uppercase tracking-wide text-white/60">{roleLabel}</p>
          <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
            {items.map((item) => {
              const active = isActive(item, items, pathname, hash);
              return (
                <Link
                  key={`${item.to}${item.hash ?? ""}`}
                  to={{ pathname: item.to, hash: item.hash }}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (active) scrollToItem(item);
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold ${
                    active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <NavIcon name={item.icon} className="h-5 w-5" />
                  {item.label}
                  <UnreadBadge count={item.badge ?? 0} />
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col gap-1">
          {extraLink && (
            <Link to={extraLink.to} className="rounded-xl px-3 py-2.5 text-sm font-bold text-white/75 hover:bg-white/10 hover:text-white">
              {extraLink.label}
            </Link>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white/75 hover:bg-white/10 hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Top bar: phones */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between gap-2 px-4 text-white md:hidden ${bg}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex min-h-14 items-center gap-2 overflow-hidden">
          <Link to={homePath} className="font-display text-lg font-extrabold">
            DirectLet
          </Link>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{roleLabel}</span>
        </div>
        <div className="flex shrink-0 items-center">
          {extraLink && (
            <Link to={extraLink.to} className="flex min-h-11 items-center px-2 text-sm font-bold text-white/80">
              {extraLink.label}
            </Link>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-11 items-center px-2 text-sm font-bold text-white/80"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Tab bar: phones */}
      <nav
        aria-label="Main"
        className={`fixed inset-x-0 bottom-0 z-40 grid border-t border-white/10 md:hidden ${bg}`}
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {items.map((item) => {
          const active = isActive(item, items, pathname, hash);
          const badge = item.badge ?? 0;
          return (
            <Link
              key={`${item.to}${item.hash ?? ""}`}
              to={{ pathname: item.to, hash: item.hash }}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (active) scrollToItem(item);
              }}
              className="flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-bold text-white"
            >
              <span className={`relative grid h-7 w-12 place-items-center rounded-full ${active ? "bg-white/20" : "text-white/70"}`}>
                <NavIcon name={item.icon} className="h-5 w-5" />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-direct-green px-1 text-center text-[10px] font-extrabold leading-4 text-night-blue">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span className={`max-w-full truncate ${active ? "" : "text-white/70"}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
