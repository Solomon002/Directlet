import { createBrowserRouter } from "react-router";
import PublicLayout from "./layouts/PublicLayout";
import LandlordLayout from "./layouts/LandlordLayout";
import TenantLayout from "./layouts/TenantLayout";
import ProtectedRoute from "./ProtectedRoute";
import Home from "../pages/public/Home";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Dashboard from "../pages/landlord/Dashboard";
import TenantHome from "../pages/tenant/Home";

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
    ],
  },
  {
    path: "/landlord",
    element: <ProtectedRoute allowedRoles={["LANDLORD"]} />,
    children: [
      {
        element: <LandlordLayout />,
        children: [{ index: true, element: <Dashboard /> }],
      },
    ],
  },
  {
    path: "/tenant",
    element: <ProtectedRoute allowedRoles={["TENANT"]} />,
    children: [
      {
        element: <TenantLayout />,
        children: [{ index: true, element: <TenantHome /> }],
      },
    ],
  },
]);
