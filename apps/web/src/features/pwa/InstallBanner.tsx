import { useEffect, useState } from "react";
import { useLocation } from "react-router";

// Chrome and Edge on Android and desktop hand the page this event when the app
// can be installed. Safari on iPhone never does, so it gets a written hint instead.
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "dl-install-dismissed";
const QUIET_DAYS = 14;
const SHOW_AFTER_MS = 4000;

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  // iPads that ask for the desktop site report themselves as a Mac with a touch screen.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

// Storage can be blocked (private windows); the banner just comes back then.
function wasDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < QUIET_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Nothing to do: it will simply show again next visit.
  }
}

export default function InstallBanner() {
  const { pathname } = useLocation();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(() => isInstalled() || wasDismissedRecently());
  const [waited, setWaited] = useState(false);
  const [ios] = useState(isIos);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Stops the browser's own small prompt so ours is the only one.
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Let people look around first before asking anything of them.
    const timer = window.setTimeout(() => setWaited(true), SHOW_AFTER_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  // Only on the pages a visitor browses, never over a chat box or a dashboard.
  const onPublicPage = pathname === "/" || pathname.startsWith("/compounds");
  if (hidden || !waited || !onPublicPage || (!installEvent && !ios)) return null;

  function dismiss() {
    rememberDismissal();
    setHidden(true);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "dismissed") dismiss();
  }

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-night-blue p-3 text-white shadow-xl"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="region"
      aria-label="Install DirectLet"
    >
      <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-extrabold">Get DirectLet on your phone</p>
        <p className="text-xs text-white/80">
          {installEvent ? "Opens full screen like an app. No store needed." : "Tap Share, then Add to Home Screen."}
        </p>
      </div>
      {installEvent && (
        <button
          type="button"
          onClick={() => void install()}
          className="shrink-0 rounded-xl bg-direct-green px-4 py-2 font-display text-sm font-extrabold text-night-blue"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-white/70 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
