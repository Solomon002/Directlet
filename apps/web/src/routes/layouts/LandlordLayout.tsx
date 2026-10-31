import { useUnreadCount } from "../../features/messages/api";
import PortalShell, { type NavItem } from "../../features/nav/PortalShell";

export default function LandlordLayout() {
  const unread = useUnreadCount();

  const items: NavItem[] = [
    { to: "/landlord", label: "Dashboard", icon: "home", end: true },
    { to: "/landlord/properties", label: "Properties", icon: "building" },
    { to: "/landlord/tenancies", label: "Tenancies", icon: "clipboard" },
    { to: "/landlord/inspections", label: "Inspections", icon: "calendar" },
    { to: "/landlord/messages", label: "Messages", icon: "chat", badge: unread },
  ];

  return <PortalShell tone="landlord" homePath="/landlord" roleLabel="Landlord" items={items} />;
}
