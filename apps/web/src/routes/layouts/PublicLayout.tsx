import { Link, Outlet } from "react-router";

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-mist">
      <header className="flex items-center justify-between bg-white px-8 py-4 shadow-sm">
        <Link to="/" className="font-display text-xl font-extrabold text-night-blue">
          DirectLet
        </Link>
        <nav className="flex gap-6 text-sm font-bold text-ink">
          <Link to="/login">Log in</Link>
          <Link to="/register">Sign up</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
