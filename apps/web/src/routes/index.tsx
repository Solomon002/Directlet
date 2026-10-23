import { createBrowserRouter } from "react-router";
import PublicLayout from "./layouts/PublicLayout";
import LandlordLayout from "./layouts/LandlordLayout";
import TenantLayout from "./layouts/TenantLayout";
import ProtectedRoute from "./ProtectedRoute";
import Home from "../pages/public/Home";
import Browse from "../pages/public/Browse";
import CompoundPage from "../pages/public/CompoundPage";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import AcceptInvite from "../pages/auth/AcceptInvite";
import Dashboard from "../pages/landlord/Dashboard";
import Properties from "../pages/landlord/Properties";
import PropertyDetail from "../pages/landlord/PropertyDetail";
import Tenancies from "../pages/landlord/Tenancies";
import TenancyDetail from "../pages/landlord/TenancyDetail";
import Inspections from "../pages/landlord/Inspections";
import TenantHome from "../pages/tenant/Home";

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
      { path: "/invite/:token", element: <AcceptInvite /> },
      { path: "/compounds", element: <Browse /> },
      { path: "/compounds/:propertyId", element: <CompoundPage /> },
    ],
  },
  {
    path: "/landlord",
    element: <ProtectedRoute allowedRoles={["LANDLORD"]} />,
    children: [
      {
        element: <LandlordLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "properties", element: <Properties /> },
          { path: "properties/:propertyId", element: <PropertyDetail /> },
          { path: "tenancies", element: <Tenancies /> },
          { path: "tenancies/:tenancyId", element: <TenancyDetail /> },
          { path: "inspections", element: <Inspections /> },
        ],
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
