import { useUnreadCount } from "../../features/messages/api";
import PortalShell, { type NavItem } from "../../features/nav/PortalShell";

export default function TenantLayout() {
  const unread = useUnreadCount();

  // The tenant's home is one long page, so three of the tabs jump to a section of it.
  const items: NavItem[] = [
    { to: "/tenant", label: "Home", icon: "home", end: true },
    { to: "/tenant", hash: "#pay", label: "Pay rent", icon: "card" },
    { to: "/tenant", hash: "#history", label: "Receipts", icon: "receipt" },
    { to: "/tenant", hash: "#complaints", label: "Complaints", icon: "alert" },
    { to: "/tenant/messages", label: "Messages", icon: "chat", badge: unread },
  ];

  return <PortalShell tone="tenant" homePath="/tenant" roleLabel="Tenant" items={items} />;
}
