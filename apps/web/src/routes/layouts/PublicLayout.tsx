import { Link, Outlet, useNavigate } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { homePathFor } from "../../lib/roles";
import { logout } from "../../lib/session";
import { useUnreadCount } from "../../features/messages/api";
import UnreadBadge from "../../features/messages/UnreadBadge";

export default function PublicLayout() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const unread = useUnreadCount();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-mist">
      <header className="flex items-center justify-between gap-4 bg-white px-4 py-4 shadow-sm sm:px-8">
        <Link to="/" className="font-display text-xl font-extrabold text-night-blue">
          DirectLet
        </Link>
        <nav className="flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm font-bold text-ink">
          <Link to="/compounds">Browse</Link>
          {!user && (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Sign up</Link>
            </>
          )}
          {user?.role === "HUNTER" && (
            <>
              <Link to="/messages">
                Messages
                <UnreadBadge count={unread} />
              </Link>
              <button type="button" onClick={() => void handleLogout()} className="font-bold">
                Log out
              </button>
            </>
          )}
          {user && user.role !== "HUNTER" && (
            <Link to={homePathFor(user.role)}>{user.role === "LANDLORD" ? "Dashboard" : "My home"}</Link>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
