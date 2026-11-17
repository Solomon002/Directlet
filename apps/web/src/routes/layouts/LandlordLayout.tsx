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

  // Not a tab: the phone tab bar is already full. It is in the sidebar and the menu.
  return (
    <PortalShell
      tone="landlord"
      homePath="/landlord"
      roleLabel="Landlord"
      items={items}
      extraLink={{ to: "/landlord/verification", label: "Get verified" }}
    />
  );
}
