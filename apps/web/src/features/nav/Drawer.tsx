import { useEffect, useRef, type ReactNode, type RefObject } from "react";

// A menu that slides in from the right over a dimmed page, used behind the
// hamburger button. It behaves the way people expect from one:
//   - tapping the dimmed area or pressing Escape closes it
//   - the page behind it does not scroll
//   - the Tab key stays inside it while it is open
//   - closing it returns focus to the button that opened it
export default function Drawer({
  open,
  onClose,
  label,
  returnFocusRef,
  closeTone = "dark",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  // "light" for a drawer whose top is a dark colour, so the close button stays visible.
  closeTone?: "dark" | "light";
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeHandler = useRef(onClose);
  const wasOpen = useRef(false);

  // Always call the latest onClose without restarting the effect below.
  useEffect(() => {
    closeHandler.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      );

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHandler.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    // The panel is still hidden for an instant while it starts to slide in, and a
    // hidden element cannot take focus. So keep trying for about half a second,
    // which also covers a slow phone, until the close button has focus.
    let attempts = 0;
    const focusTimer = window.setInterval(() => {
      const closeButton = panel.current?.querySelector<HTMLElement>("[data-close]");
      closeButton?.focus();
      if (document.activeElement === closeButton || ++attempts > 10) window.clearInterval(focusTimer);
    }, 50);

    return () => {
      window.clearInterval(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (wasOpen.current && !open) returnFocusRef?.current?.focus();
    wasOpen.current = open;
  }, [open, returnFocusRef]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-night-blue/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(88vw,22rem)] flex-col overflow-hidden rounded-l-3xl bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-out ${
          open ? "translate-x-0" : "invisible translate-x-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <button
          type="button"
          data-close
          onClick={onClose}
          aria-label="Close menu"
          className={`absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl ${
            closeTone === "light" ? "text-white hover:bg-white/10" : "text-ink hover:bg-mist"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {children}
      </div>
    </>
  );
}

// The three-line button that opens it.
export function HamburgerButton({
  onClick,
  open,
  controls,
  buttonRef,
  className = "text-ink hover:bg-mist",
}: {
  onClick: () => void;
  open: boolean;
  controls?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      aria-expanded={open}
      aria-controls={controls}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    </button>
  );
}
