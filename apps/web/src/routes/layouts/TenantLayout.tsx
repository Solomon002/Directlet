import { Link, Outlet, useNavigate } from "react-router";
import { logout } from "../../lib/session";
import { useUnreadCount } from "../../features/messages/api";
import UnreadBadge from "../../features/messages/UnreadBadge";

export default function TenantLayout() {
  const navigate = useNavigate();
  const unread = useUnreadCount();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-mist md:flex">
      {/* A compact top bar on phones, a sidebar from md up. */}
      <aside className="flex items-center justify-between gap-4 bg-trust-blue px-4 py-3 text-white md:w-56 md:flex-col md:items-start md:px-6 md:py-8">
        <div className="flex items-center gap-5 md:block">
          <Link to="/tenant" className="font-display text-lg font-extrabold">
            DirectLet
          </Link>
          <nav className="flex gap-4 text-sm font-bold md:mt-8 md:flex-col md:gap-3">
            <Link to="/tenant">Home</Link>
            <Link to="/tenant/messages">
              Messages
              <UnreadBadge count={unread} />
            </Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 whitespace-nowrap text-left text-sm font-bold text-white/70 hover:text-white"
        >
          Log out
        </button>
      </aside>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
