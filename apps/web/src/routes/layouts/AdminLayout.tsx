import PortalShell, { type NavItem } from "../../features/nav/PortalShell";

const items: NavItem[] = [
  { to: "/admin", label: "Overview", icon: "chart", end: true },
  { to: "/admin/users", label: "Users", icon: "users" },
  { to: "/admin/properties", label: "Properties", icon: "building" },
  { to: "/admin/verifications", label: "Verify", icon: "shield" },
  { to: "/admin/reports", label: "Reports", icon: "alert" },
  { to: "/admin/activity", label: "Activity", icon: "list" },
];

export default function AdminLayout() {
  return (
    <PortalShell
      tone="admin"
      homePath="/admin"
      roleLabel="Admin"
      items={items}
      extraLink={{ to: "/compounds", label: "View site" }}
    />
  );
}
