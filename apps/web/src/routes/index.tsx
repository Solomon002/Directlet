import { createBrowserRouter } from "react-router";
import PublicLayout from "./layouts/PublicLayout";
import LandlordLayout from "./layouts/LandlordLayout";
import TenantLayout from "./layouts/TenantLayout";
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
    element: <LandlordLayout />,
    children: [{ index: true, element: <Dashboard /> }],
  },
  {
    path: "/tenant",
    element: <TenantLayout />,
    children: [{ index: true, element: <TenantHome /> }],
  },
]);
