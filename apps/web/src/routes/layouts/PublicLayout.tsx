import { Outlet } from "react-router";
import PublicHeader from "../../features/nav/PublicHeader";
import { useScrollOnNavigate } from "../../features/nav/useScrollOnNavigate";

export default function PublicLayout() {
  useScrollOnNavigate();

  return (
    <div className="min-h-screen bg-mist">
      <PublicHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
