import { useState } from "react";
import { useLocation } from "react-router";
import { isIos, promptInstall, useInstall } from "./installState";

// A slim bar fixed to the bottom of the phone screen, for as long as the app is
// not installed. The x only hides it for this visit; it is back next time.
const HIDDEN_KEY = "dl-install-bar-hidden";

function hiddenThisVisit() {
  try {
    return sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export default function InstallBanner() {
  const { pathname } = useLocation();
  const { canPrompt, installed } = useInstall();
  const [hidden, setHidden] = useState(hiddenThisVisit);
  const [ios] = useState(isIos);

  // Only on the pages a visitor browses, never over a chat box or a dashboard.
  const onPublicPage = pathname === "/" || pathname.startsWith("/compounds");
  if (installed || hidden || !onPublicPage || (!canPrompt && !ios)) return null;

  function hide() {
    try {
      sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      // The bar just comes back on the next page load.
    }
    setHidden(true);
  }

  return (
    <>
      {/* Keeps the bar from covering the bottom of the page. */}
      <div className="h-16 md:hidden" aria-hidden="true" />
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 bg-night-blue px-3 pt-2 text-white shadow-[0_-4px_16px_rgba(0,0,0,0.25)] md:hidden"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
        role="region"
        aria-label="Install DirectLet"
      >
        <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-extrabold">Install DirectLet</p>
          <p className="truncate text-xs text-white/80">
            {canPrompt ? "Opens full screen, like an app" : "Tap Share, then Add to Home Screen"}
          </p>
        </div>
        {canPrompt && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="shrink-0 rounded-xl bg-direct-green px-4 py-2 font-display text-sm font-extrabold text-night-blue"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={hide}
          aria-label="Hide for now"
          className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-white/70 hover:text-white"
        >
          ×
        </button>
      </div>
    </>
  );
}
