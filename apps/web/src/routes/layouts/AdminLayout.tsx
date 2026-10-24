import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { logout } from "../../lib/session";

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "text-direct-green" : "");

export default function AdminLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-mist md:flex">
      {/* A compact top bar on phones, a sidebar from md up. */}
      <aside className="flex items-start justify-between gap-4 bg-ink px-4 py-3 text-white md:w-56 md:flex-col md:px-6 md:py-8">
        <div>
          <Link to="/admin" className="font-display text-lg font-extrabold">
            DirectLet <span className="text-direct-green">Admin</span>
          </Link>
          <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold md:mt-8 md:flex-col md:gap-3">
            <NavLink to="/admin" end className={navClass}>
              Overview
            </NavLink>
            <NavLink to="/admin/users" className={navClass}>
              Users
            </NavLink>
            <NavLink to="/admin/properties" className={navClass}>
              Properties
            </NavLink>
            <NavLink to="/admin/activity" className={navClass}>
              Activity
            </NavLink>
            <Link to="/compounds" className="text-white/70">
              View site
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
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
