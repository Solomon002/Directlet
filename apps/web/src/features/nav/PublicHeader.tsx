import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { homePathFor } from "../../lib/roles";
import { logout } from "../../lib/session";
import { useUnreadCount } from "../messages/api";
import UnreadBadge from "../messages/UnreadBadge";
import { promptInstall, useInstall } from "../pwa/installState";
import Brand from "./Brand";
import Drawer, { HamburgerButton } from "./Drawer";

type HeaderLink = { label: string; to: string; hash?: string };

// The last three jump to sections of the landing page.
const LINKS: HeaderLink[] = [
  { label: "Browse", to: "/compounds" },
  { label: "How it works", to: "/", hash: "#how" },
  { label: "For landlords", to: "/", hash: "#landlords" },
  { label: "FAQ", to: "/", hash: "#faq" },
];

const roleHomeLabel = { LANDLORD: "Dashboard", TENANT: "My home", ADMIN: "Admin", HUNTER: "Browse" } as const;

export default function PublicHeader() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useUnreadCount();
  const { canPrompt } = useInstall();
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);

  // The menu is open only for the page it was opened on, so any navigation closes it.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey === location.key;
  const closeMenu = () => setOpenKey(null);

  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function isActive(link: HeaderLink) {
    if (link.hash) return location.pathname === link.to && location.hash === link.hash;
    return location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
  }

  // Tapping a link to the section you are already at does not change the address,
  // so scroll to it by hand.
  function onLinkClick(link: HeaderLink) {
    closeMenu();
    if (link.hash && isActive(link)) document.getElementById(link.hash.slice(1))?.scrollIntoView({ block: "start" });
  }

  async function handleLogout() {
    closeMenu();
    await logout();
    navigate("/", { replace: true });
  }

  const linkClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
      active ? "bg-trust-blue/10 text-trust-blue" : "text-ink/80 hover:bg-mist hover:text-trust-blue"
    }`;

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-md transition-shadow ${
        scrolled ? "border-mist bg-white/90 shadow-sm" : "border-transparent bg-white/80"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
        <Brand />

        {/* Larger screens: links in the middle, account on the right */}
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              to={{ pathname: link.to, hash: link.hash }}
              onClick={() => onLinkClick(link)}
              aria-current={isActive(link) ? "page" : undefined}
              className={linkClass(isActive(link))}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {canPrompt && (
            <button type="button" onClick={() => void promptInstall()} className="rounded-lg px-3 py-2 text-sm font-bold text-trust-blue hover:bg-mist">
              Install app
            </button>
          )}
          {!user && (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-bold text-ink/80 hover:bg-mist hover:text-trust-blue">
                Log in
              </Link>
              <Link to="/register" className="rounded-xl bg-trust-blue px-4 py-2 font-display text-sm font-extrabold text-white shadow-sm hover:bg-night-blue">
                Sign up
              </Link>
            </>
          )}
          {user?.role === "HUNTER" && (
            <Link to="/messages" className="rounded-lg px-3 py-2 text-sm font-bold text-ink/80 hover:bg-mist hover:text-trust-blue">
              Messages
              <UnreadBadge count={unread} />
            </Link>
          )}
          {user && user.role !== "HUNTER" && (
            <Link to={homePathFor(user.role)} className="rounded-xl bg-trust-blue px-4 py-2 font-display text-sm font-extrabold text-white shadow-sm hover:bg-night-blue">
              {roleHomeLabel[user.role]}
            </Link>
          )}
          {user && (
            <button type="button" onClick={() => void handleLogout()} className="rounded-lg px-3 py-2 text-sm font-bold text-ink/70 hover:bg-mist hover:text-ink">
              Log out
            </button>
          )}
        </div>

        {/* Phones: a Sign up button (when signed out) and the hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          {!user && (
            <Link to="/register" className="rounded-xl bg-trust-blue px-3.5 py-2 font-display text-sm font-extrabold text-white max-[359px]:hidden">
              Sign up
            </Link>
          )}
          {user?.role === "HUNTER" && unread > 0 && (
            <Link to="/messages" aria-label={`${unread} unread messages`} className="rounded-xl bg-direct-green px-3 py-2 text-sm font-extrabold text-night-blue">
              {unread > 99 ? "99+" : unread}
            </Link>
          )}
          <HamburgerButton onClick={() => setOpenKey(location.key)} open={open} controls={menuId} buttonRef={menuButton} />
        </div>
      </div>

      <Drawer open={open} onClose={closeMenu} label="Menu" returnFocusRef={menuButton}>
        <div id={menuId} className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pb-3 pt-4">
            <Brand onClick={closeMenu} />
          </div>

          <nav aria-label="Menu" className="flex-1 overflow-y-auto px-3 py-2">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                to={{ pathname: link.to, hash: link.hash }}
                onClick={() => onLinkClick(link)}
                aria-current={isActive(link) ? "page" : undefined}
                className={`flex min-h-12 items-center rounded-xl px-3 text-lg font-bold ${
                  isActive(link) ? "bg-trust-blue/10 text-trust-blue" : "text-night-blue hover:bg-mist"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "HUNTER" && (
              <Link to="/messages" onClick={closeMenu} className="flex min-h-12 items-center rounded-xl px-3 text-lg font-bold text-night-blue hover:bg-mist">
                Messages
                <UnreadBadge count={unread} />
              </Link>
            )}
            {canPrompt && (
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  void promptInstall();
                }}
                className="flex min-h-12 w-full items-center rounded-xl px-3 text-left text-lg font-bold text-trust-blue hover:bg-mist"
              >
                Install the app
              </button>
            )}
          </nav>

          <div className="border-t border-mist bg-mist/40 p-4">
            {!user ? (
              <div className="flex flex-col gap-2">
                <Link to="/register" onClick={closeMenu} className="rounded-xl bg-trust-blue px-5 py-3 text-center font-display font-extrabold text-white">
                  Sign up free
                </Link>
                <Link to="/login" onClick={closeMenu} className="rounded-xl border-2 border-trust-blue px-5 py-3 text-center font-display font-extrabold text-trust-blue">
                  Log in
                </Link>
                <Link to="/register?as=landlord" onClick={closeMenu} className="py-2 text-center text-sm font-bold text-trust-blue">
                  I'm a landlord: list free
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="truncate text-sm font-bold text-night-blue">{user.fullName}</p>
                <p className="-mt-1 truncate text-xs text-ink/60">{user.email}</p>
                {user.role !== "HUNTER" && (
                  <Link to={homePathFor(user.role)} onClick={closeMenu} className="rounded-xl bg-trust-blue px-5 py-3 text-center font-display font-extrabold text-white">
                    Go to {roleHomeLabel[user.role].toLowerCase()}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-xl border-2 border-red-600 px-5 py-3 font-display font-extrabold text-red-600"
                >
                  Log out
                </button>
              </div>
            )}
            <p className="mt-3 text-center text-xs text-ink/50">No Agent Wahala.</p>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
