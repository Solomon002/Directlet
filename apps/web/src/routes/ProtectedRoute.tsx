import { Navigate, Outlet, useLocation } from "react-router";
import { useAuthStore, type UserRole } from "../stores/authStore";
import { homePathFor } from "../lib/roles";

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <p className="font-display text-sm font-bold text-ink">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  return <Outlet />;
}
