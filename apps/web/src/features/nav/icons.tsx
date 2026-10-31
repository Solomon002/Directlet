// Simple line icons for the portal navigation, drawn in code so they need no
// files and take on the colour of the text around them.
export type IconName =
  | "home"
  | "building"
  | "clipboard"
  | "calendar"
  | "chat"
  | "card"
  | "receipt"
  | "alert"
  | "chart"
  | "users"
  | "list";

const PATHS: Record<IconName, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5",
  building: "M5 20V4h10v16M15 9h4v11M3 20h18M9 8h2M9 12h2M9 16h2",
  clipboard: "M9 4h6l1 2h3v14H5V6h3l1-2zM9 11h6M9 15h6",
  calendar: "M5 6h14v14H5zM5 10h14M9 3.5v4M15 3.5v4",
  chat: "M4 5h16v11H9l-5 4V5z",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
  alert: "M12 3.5 2.5 20h19L12 3.5zM12 10v4.5M12 17.5h.01",
  chart: "M4 20V11M10 20V4M16 20v-6M2 20h20",
  users: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16.5 11a3 3 0 000-6M21 20c0-2.6-1.6-4.6-4-5.6",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
};

export function NavIcon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
