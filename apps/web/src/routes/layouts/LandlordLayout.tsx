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
      <aside className="flex flex-col justify-between bg-night-blue px-6 py-8 text-white md:w-56">
        <div>
          <Link to="/landlord" className="font-display text-lg font-extrabold">
            DirectLet
          </Link>
          <nav className="mt-8 flex flex-col gap-3 text-sm font-bold">
            <Link to="/landlord">Dashboard</Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-left text-sm font-bold text-white/70 hover:text-white"
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
