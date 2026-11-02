import { useEffect } from "react";
import { useLocation } from "react-router";

// Moving to another page starts it at the top, and a link that points at a
// section of a page (like "/#faq") scrolls to it. The section may not exist yet
// if its data is still loading, so it keeps looking for a couple of seconds.
export function useScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      const target = document.getElementById(hash.slice(1));
      if (target || ++tries > 20) {
        window.clearInterval(timer);
        target?.scrollIntoView({ block: "start" });
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [pathname, hash]);
}
