// Five stars, filled up to the rating. Read aloud as "4 out of 5".
export default function Stars({ value, className = "" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span role="img" aria-label={`${value} out of 5`} className={`inline-flex text-amber-500 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill={n <= filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />
        </svg>
      ))}
    </span>
  );
}
