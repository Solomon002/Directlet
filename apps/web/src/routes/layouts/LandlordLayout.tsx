import { Link, Outlet, useNavigate } from "react-router";
import { logout } from "../../lib/session";

export default function LandlordLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-mist md:flex">
      {/* A compact top bar on phones, a sidebar from md up. */}
      <aside className="flex items-start justify-between gap-4 bg-night-blue px-4 py-3 text-white md:w-56 md:flex-col md:px-6 md:py-8">
        <div>
          <Link to="/landlord" className="font-display text-lg font-extrabold">
            DirectLet
          </Link>
          <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold md:mt-8 md:flex-col md:gap-3">
            <Link to="/landlord">Dashboard</Link>
            <Link to="/landlord/properties">Properties</Link>
            <Link to="/landlord/tenancies">Tenancies</Link>
            <Link to="/landlord/inspections">Inspections</Link>
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
