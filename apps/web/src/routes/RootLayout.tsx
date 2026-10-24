import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { API_URL } from "../lib/authApi";

// Counts one page view per page opened. No cookies are set and nothing
// identifies the visitor; the API only keeps a daily-changing hash.
function usePageViews() {
  const location = useLocation();

  useEffect(() => {
    // The admin panel is you looking at the numbers; don't count yourself.
    if (location.pathname.startsWith("/admin")) return;
    void fetch(`${API_URL}/analytics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location.pathname, referrer: document.referrer || undefined }),
      keepalive: true,
    }).catch(() => undefined);
  }, [location.pathname]);
}

export default function RootLayout() {
  usePageViews();
  return <Outlet />;
}
