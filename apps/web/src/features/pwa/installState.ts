import { useSyncExternalStore } from "react";

// Chrome and Edge hand the page an "install" event once, early in the visit.
// This file catches it the moment the app loads (before any screen has appeared)
// and keeps it, so the bottom bar and the header link can both use it.
// Safari on iPhone never sends the event, so it gets written instructions instead.
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = { canPrompt: boolean; installed: boolean };

function runningAsApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  const ua = navigator.userAgent;
  // iPads that ask for the desktop site report themselves as a Mac with a touch screen.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

let waiting: InstallEvent | null = null;
let state: InstallState = { canPrompt: false, installed: runningAsApp() };
const listeners = new Set<() => void>();

function update(next: InstallState) {
  state = next;
  listeners.forEach((listener) => listener());
}

window.addEventListener("beforeinstallprompt", (event) => {
  // Stops the browser's own small prompt, so ours is the only one.
  event.preventDefault();
  waiting = event as InstallEvent;
  update({ ...state, canPrompt: true });
});

window.addEventListener("appinstalled", () => {
  waiting = null;
  update({ canPrompt: false, installed: true });
});

// The first version remembered a dismissal for two weeks. That rule is gone,
// so clear what it left on people's phones.
try {
  localStorage.removeItem("dl-install-dismissed");
} catch {
  // Storage can be blocked; nothing to clean up then.
}

export function useInstall(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

// Opens the browser's own install dialog. The event can only be used once, so it
// is dropped here; the browser sends a new one on the next visit if needed.
export async function promptInstall() {
  const event = waiting;
  if (!event) return;
  waiting = null;
  update({ ...state, canPrompt: false });
  await event.prompt();
  await event.userChoice;
}
