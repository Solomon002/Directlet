import { Link } from "react-router";

// The logo lockup: the icon next to the wordmark. The icon is a placeholder until
// the designers' logo arrives; replace /icon.svg and every header picks it up.
export default function Brand({
  to = "/",
  tone = "dark",
  onClick,
}: {
  to?: string;
  tone?: "dark" | "light";
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 font-display text-xl font-extrabold ${
        tone === "light" ? "text-white" : "text-night-blue"
      }`}
    >
      <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
      DirectLet
    </Link>
  );
}
