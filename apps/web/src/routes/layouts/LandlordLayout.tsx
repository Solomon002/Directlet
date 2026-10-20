import { Link, Outlet } from "react-router";

export default function LandlordLayout() {
  return (
    <div className="min-h-screen bg-mist md:flex">
      <aside className="bg-night-blue px-6 py-8 text-white md:w-56">
        <Link to="/landlord" className="font-display text-lg font-extrabold">
          DirectLet
        </Link>
        <nav className="mt-8 flex flex-col gap-3 text-sm font-bold">
          <Link to="/landlord">Dashboard</Link>
        </nav>
      </aside>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
