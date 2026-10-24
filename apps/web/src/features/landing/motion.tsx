import { useEffect, useRef, useState, type ReactNode } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Fades and lifts its content in the first time it scrolls into view. Content
// is always shown when IntersectionObserver is missing or motion is reduced.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(
    () => typeof window === "undefined" || !("IntersectionObserver" in window) || prefersReducedMotion(),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`dl-reveal ${shown ? "dl-reveal-in" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
