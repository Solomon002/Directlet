import { Link, Outlet } from "react-router";

export default function TenantLayout() {
  return (
    <div className="min-h-screen bg-mist md:flex">
      <aside className="bg-trust-blue px-6 py-8 text-white md:w-56">
        <Link to="/tenant" className="font-display text-lg font-extrabold">
          DirectLet
        </Link>
        <nav className="mt-8 flex flex-col gap-3 text-sm font-bold">
          <Link to="/tenant">Home</Link>
        </nav>
      </aside>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
