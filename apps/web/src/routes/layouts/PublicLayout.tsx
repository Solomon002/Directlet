import { Outlet } from "react-router";
import PublicHeader from "../../features/nav/PublicHeader";
import { useScrollOnNavigate } from "../../features/nav/useScrollOnNavigate";
import ConfirmEmail from "../../features/trust/ConfirmEmail";
import { useAuthStore } from "../../stores/authStore";

export default function PublicLayout() {
  useScrollOnNavigate();
  const role = useAuthStore((s) => s.user?.role);

  return (
    <div className="min-h-screen bg-mist">
      <PublicHeader />
      <main>
        {/* Only people who can ask for viewings need to confirm their email. */}
        {(role === "HUNTER" || role === "TENANT") && <ConfirmEmail />}
        <Outlet />
      </main>
    </div>
  );
}
