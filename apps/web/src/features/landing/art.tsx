import type { ReactNode } from "react";

// Illustrations drawn for DirectLet in the brand colours. They are SVG, so they
// are sharp at any size, load instantly and carry no licensing questions.
// Motion comes from the dl-* classes in index.css and stops for people who
// ask their device to reduce motion.

const BLUE = "#174A9D";
const GREEN = "#1DB954";
const NIGHT = "#0B295B";
const MIST = "#E3E8F0";

// Which windows are "vacant" (green, blinking) in the hero buildings.
const VACANT_A = new Set(["1-0", "3-2"]);
const VACANT_B = new Set(["0-1", "2-2"]);

function Windows({
  x,
  y,
  cols,
  rows,
  vacant,
  fill = "#FFFFFF",
}: {
  x: number;
  y: number;
  cols: number;
  rows: number;
  vacant: Set<string>;
  fill?: string;
}) {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${row}-${col}`;
      const isVacant = vacant.has(key);
      cells.push(
        <rect
          key={key}
          x={x + col * 32}
          y={y + row * 36}
          width={20}
          height={24}
          rx={3}
          fill={isVacant ? GREEN : fill}
          opacity={isVacant ? 1 : 0.85}
          className={isVacant ? "dl-blink" : undefined}
          style={isVacant ? { animationDelay: `${(row + col) * 0.5}s` } : undefined}
        />,
      );
    }
  }
  return <g>{cells}</g>;
}

export function HeroScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 440"
      className={`dl-anim ${className ?? ""}`}
      role="img"
      aria-label="A compound of flats in Lagos with a map pin, a chat with the owner, and a direct route to the door"
    >
      <circle cx="270" cy="215" r="196" fill="#EAF0FA" />
      <circle cx="270" cy="215" r="146" fill={MIST} opacity="0.6" />

      {/* ground and trees */}
      <rect x="40" y="360" width="440" height="6" rx="3" fill={NIGHT} opacity="0.15" />
      <rect x="92" y="332" width="6" height="28" fill={NIGHT} opacity="0.5" />
      <circle cx="95" cy="324" r="20" fill={GREEN} opacity="0.85" />
      <rect x="487" y="338" width="5" height="22" fill={NIGHT} opacity="0.5" />
      <circle cx="489" cy="332" r="15" fill={GREEN} opacity="0.7" />

      {/* tall block */}
      <rect x="120" y="150" width="110" height="210" rx="6" fill={NIGHT} />
      <Windows x={136} y={170} cols={3} rows={5} vacant={VACANT_A} />

      {/* middle block */}
      <rect x="240" y="200" width="130" height="160" rx="6" fill={BLUE} />
      <Windows x={256} y={218} cols={3} rows={4} vacant={VACANT_B} />

      {/* small house with the brand's roof shape */}
      <rect x="385" y="265" width="90" height="95" rx="4" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
      <polygon points="375,268 430,222 485,268" fill={BLUE} />
      <rect x="419" y="320" width="22" height="40" rx="3" fill={NIGHT} />
      <rect x="397" y="286" width="20" height="20" rx="3" fill="#EAF0FA" stroke="#D5DCE8" />
      <rect x="443" y="286" width="20" height="20" rx="3" fill="#EAF0FA" stroke="#D5DCE8" />

      {/* the direct line from you to the owner's door */}
      <path
        d="M 62 405 C 150 412, 232 345, 286 252 S 300 196, 305 180"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M 62 405 C 150 412, 232 345, 286 252 S 300 196, 305 180"
        fill="none"
        stroke={GREEN}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 12"
        className="dl-dash"
      />
      <circle cx="62" cy="405" r="14" fill={BLUE} opacity="0.25" className="dl-ping" />
      <circle cx="62" cy="405" r="9" fill="#FFFFFF" stroke={BLUE} strokeWidth="4" />

      {/* map pin hovering over the middle block */}
      <ellipse cx="305" cy="190" rx="18" ry="5" fill={NIGHT} className="dl-shadow" />
      <g transform="translate(305 176)">
        <g className="dl-float">
          <path
            d="M0 0 C-16 -22 -28 -34 -28 -50 a28 28 0 1 1 56 0 c0 16 -12 28 -28 50z"
            fill={GREEN}
            stroke="#FFFFFF"
            strokeWidth="4"
          />
          <circle cx="0" cy="-50" r="11" fill="#FFFFFF" />
        </g>
      </g>

      {/* chat: you ask, the owner answers */}
      <g className="dl-float-slow">
        <g>
          <rect x="34" y="76" width="176" height="46" rx="16" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
          <polygon points="70,122 84,122 66,138" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
          <rect x="68" y="119" width="18" height="5" fill="#FFFFFF" />
          <text x="50" y="104" fontSize="13" fontWeight="600" fill={NIGHT} fontFamily="Inter Variable, system-ui, sans-serif">
            Is Flat 2 still available?
          </text>
        </g>
      </g>
      <g className="dl-pop" style={{ animationDelay: "1.6s" }}>
        <rect x="304" y="44" width="200" height="44" rx="16" fill={BLUE} />
        <polygon points="466,88 482,88 476,104" fill={BLUE} />
        <text x="320" y="71" fontSize="13" fontWeight="600" fill="#FFFFFF" fontFamily="Inter Variable, system-ui, sans-serif">
          Yes! Come see it Saturday.
        </text>
      </g>

      {/* typing dots */}
      <g transform="translate(150 150)">
        <rect width="46" height="26" rx="13" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={13 + i * 10} cy={13} r={3} fill={BLUE} className="dl-typing" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </g>

      {/* price tag */}
      <g className="dl-float-slow" style={{ animationDelay: "1s" }}>
        <rect x="330" y="384" width="158" height="34" rx="17" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
        <text x="409" y="406" textAnchor="middle" fontSize="14" fontWeight="800" fill={BLUE} fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
          NGN 1.8M / year
        </text>
      </g>
    </svg>
  );
}

function IconFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" role="img" aria-label={label}>
      <rect width="96" height="96" rx="24" fill="#EAF0FA" />
      {children}
    </svg>
  );
}

export function IconFind() {
  return (
    <IconFrame label="Find a flat on the map">
      <g className="dl-anim">
        <rect x="18" y="26" width="48" height="40" rx="6" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
        <path d="M18 46 L34 38 L48 48 L66 36" fill="none" stroke={MIST} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <g className="dl-float">
          <path d="M42 50 C36 43 32 38 32 32 a10 10 0 1 1 20 0 c0 6 -4 11 -10 18z" fill={GREEN} stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="42" cy="32" r="4" fill="#FFFFFF" />
        </g>
        <circle cx="64" cy="62" r="11" fill="#FFFFFF" stroke={BLUE} strokeWidth="4" />
        <line x1="72" y1="70" x2="80" y2="78" stroke={BLUE} strokeWidth="5" strokeLinecap="round" />
      </g>
    </IconFrame>
  );
}

export function IconAsk() {
  return (
    <IconFrame label="Message the owner">
      <g className="dl-anim">
        <rect x="14" y="22" width="44" height="28" rx="12" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
        <polygon points="24,50 34,50 24,60" fill="#FFFFFF" stroke="#D5DCE8" strokeWidth="2" />
        <rect x="23" y="48" width="12" height="4" fill="#FFFFFF" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={28 + i * 10} cy={36} r={3} fill={BLUE} className="dl-typing" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
        <g className="dl-pop" style={{ animationDelay: "0.4s" }}>
          <rect x="38" y="52" width="44" height="26" rx="12" fill={BLUE} />
          <polygon points="72,78 62,78 72,86" fill={BLUE} />
          <path d="M50 65 l6 6 l12 -12" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </IconFrame>
  );
}

export function IconView() {
  return (
    <IconFrame label="Visit the flat and get the keys">
      <g className="dl-anim">
        <rect x="24" y="26" width="38" height="52" rx="5" fill={NIGHT} />
        <rect x="30" y="34" width="26" height="40" rx="3" fill={BLUE} />
        <circle cx="52" cy="54" r="2.5" fill="#FFFFFF" />
        <g className="dl-float">
          <circle cx="68" cy="40" r="11" fill={GREEN} stroke="#FFFFFF" strokeWidth="3" />
          <circle cx="68" cy="40" r="4" fill="#FFFFFF" />
          <rect x="66" y="49" width="4" height="22" rx="2" fill={GREEN} />
          <rect x="70" y="60" width="8" height="4" rx="2" fill={GREEN} />
          <rect x="70" y="67" width="6" height="4" rx="2" fill={GREEN} />
        </g>
      </g>
    </IconFrame>
  );
}

// A small thumbnail for a compound card. The shapes vary with the seed, so
// each listing looks its own without needing a photo.
export function CompoundThumb({ seed }: { seed: number }) {
  const palettes = [
    [NIGHT, BLUE, "#8FB0E6"],
    [BLUE, NIGHT, "#9DC1F2"],
    [NIGHT, "#2E5CAA", "#B7CDF0"],
  ];
  const [a, b, c] = palettes[seed % palettes.length];
  const h1 = 70 + ((seed * 17) % 36);
  const h2 = 50 + ((seed * 29) % 40);
  const h3 = 34 + ((seed * 11) % 26);
  return (
    <svg viewBox="0 0 240 120" className="h-full w-full" role="img" aria-label="Compound illustration" preserveAspectRatio="xMidYMid slice">
      <rect width="240" height="120" fill="#EAF0FA" />
      <circle cx={190 - (seed % 3) * 20} cy="32" r="14" fill="#FFFFFF" opacity="0.9" />
      <rect x="40" y={104 - h1} width="52" height={h1} rx="4" fill={a} />
      <rect x="98" y={104 - h2} width="64" height={h2} rx="4" fill={b} />
      <rect x="168" y={104 - h3} width="40" height={h3} rx="4" fill={c} />
      {[0, 1].map((r) =>
        [0, 1].map((col) => (
          <rect key={`${r}${col}`} x={50 + col * 20} y={104 - h1 + 10 + r * 20} width="12" height="12" rx="2" fill="#FFFFFF" opacity="0.8" />
        )),
      )}
      <rect x="20" y="104" width="200" height="4" rx="2" fill={NIGHT} opacity="0.15" />
      <circle cx="24" cy="94" r="10" fill={GREEN} opacity="0.8" />
      <rect x="23" y="100" width="3" height="6" fill={NIGHT} opacity="0.4" />
    </svg>
  );
}

// A mock of the landlord's rent dashboard, drawn in HTML so the bars can grow
// when it scrolls into view. The figures are examples, labelled as such.
export function DashboardMock() {
  const bars = [38, 52, 44, 66, 58, 80, 92];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-extrabold text-night-blue">Your dashboard</p>
        <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/60">Example</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Collected", "NGN 2.6M", "text-night-blue"],
          ["Outstanding", "NGN 1.2M", "text-night-blue"],
          ["Overdue", "NGN 300K", "text-red-600"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-lg bg-mist/60 p-2">
            <p className="text-[10px] font-bold text-ink/60">{label}</p>
            <p className={`font-display text-sm font-extrabold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-24 items-end gap-2">
        {bars.map((height, i) => (
          <div
            key={i}
            className="dl-bar flex-1 rounded-t bg-trust-blue"
            style={{ height: `${height}%`, ["--d" as string]: `${i * 90}ms` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between rounded-lg bg-mist/60 px-3 py-2">
          <span className="font-bold text-night-blue">Chidi, Flat 3: payment with proof</span>
          <span className="rounded-full bg-direct-green px-2 py-0.5 font-bold text-white">Confirm</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-mist/60 px-3 py-2">
          <span className="font-bold text-night-blue">Ada, Flat 7: due in 10 days</span>
          <span className="font-bold text-trust-blue">Reminder</span>
        </div>
      </div>
    </div>
  );
}

// The brand's rising green arrow, drawn large for the closing banner.
export function RisingArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={`dl-anim ${className ?? ""}`} aria-hidden="true">
      <polygon points="20,110 100,40 180,110" fill={BLUE} opacity="0.55" />
      <rect x="44" y="110" width="112" height="70" rx="6" fill={BLUE} opacity="0.35" />
      <g className="dl-rise">
        <path d="M100 150 V60" stroke={GREEN} strokeWidth="14" strokeLinecap="round" />
        <path d="M68 90 L100 56 L132 90" fill="none" stroke={GREEN} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
