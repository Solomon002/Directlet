import { useEffect, useRef } from "react";

// The "select all the images with..." check, by hCaptcha. hCaptcha picks the pictures
// and the question itself, differently for every visitor, and checks the answer on its
// side. We only show it and pass on the token it gives us.
type HCaptcha = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    hcaptcha?: HCaptcha;
  }
}

const SCRIPT_SRC = "https://js.hcaptcha.com/1/api.js?render=explicit";

// Loaded once, the first time a check is shown.
let scriptPromise: Promise<void> | null = null;
function loadScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.hcaptcha) return resolve();
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the robot check"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function Captcha({
  siteKey,
  onToken,
  resetSignal,
  onLoadError,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  // Change this number to start a fresh check (a token can only be used once).
  resetSignal: number;
  onLoadError: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Kept in a ref so the widget is not torn down every time the parent re-renders.
  const handlers = useRef({ onToken, onLoadError });
  handlers.current = { onToken, onLoadError };

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.hcaptcha || widgetId.current !== null) return;
        widgetId.current = window.hcaptcha.render(box.current, {
          sitekey: siteKey,
          callback: (token) => handlers.current.onToken(token),
          "expired-callback": () => handlers.current.onToken(null),
          "error-callback": () => handlers.current.onToken(null),
        });
      })
      .catch(() => handlers.current.onLoadError());

    return () => {
      cancelled = true;
      if (widgetId.current !== null) {
        window.hcaptcha?.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current !== null) window.hcaptcha?.reset(widgetId.current);
  }, [resetSignal]);

  return <div ref={box} className="flex min-h-[78px] justify-center" aria-label="Are you a robot check" />;
}
