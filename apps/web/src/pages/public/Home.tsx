import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { listPublicProperties, type PublicProperty } from "../../features/public/api";
import {
  CompoundThumb,
  DashboardMock,
  HeroScene,
  IconAsk,
  IconFind,
  IconView,
  RisingArrow,
} from "../../features/landing/art";
import { Reveal } from "../../features/landing/motion";
import { useAnimatedNumber } from "../../features/landing/useAnimatedNumber";
import { useAuthStore } from "../../stores/authStore";
import { homePathFor } from "../../lib/roles";
import { formatRent, naira } from "../../lib/money";

const YEAR = new Date().getFullYear();
const page = "mx-auto w-full max-w-6xl px-4 sm:px-8";
const sectionTitle = "font-display text-3xl font-extrabold text-night-blue sm:text-4xl";

const TICKER = [
  "Zero agent commission",
  "Message the owner directly",
  "See what is vacant",
  "Directions in one tap",
  "A receipt for every payment",
  "No agent wahala",
];

function bedrooms(min?: number | null, max?: number | null) {
  if (min == null || max == null) return null;
  return min === max ? `${min} bed` : `${min}-${max} bed`;
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-direct-green" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
      <path d="M5.5 10.5 8.5 13.5 14.5 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Hero({ areas }: { areas: string[] }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [area, setArea] = useState("");

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const value = area.trim();
    navigate(value ? `/compounds?area=${encodeURIComponent(value)}` : "/compounds");
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-mist">
      <div className={`${page} grid items-center gap-8 py-10 sm:py-16 lg:grid-cols-2 lg:gap-12`}>
        <div>
          <p className="inline-block rounded-full bg-direct-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-night-blue">
            Homes in Lagos · Direct from the owner
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-night-blue sm:text-5xl lg:text-6xl">
            Skip the agent.
            <br />
            <span className="text-trust-blue">Call the owner.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink/80">
            Find a flat, see it on the map, get directions in one tap and message the person who owns it. No agent
            commission. No agent wahala.
          </p>

          <form onSubmit={handleSearch} className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="hero-area">
              Area
            </label>
            <input
              id="hero-area"
              list="hero-areas"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Which area? e.g. Yaba"
              className="min-w-0 flex-1 rounded-xl border border-mist bg-white px-4 py-3 font-sans text-ink shadow-sm"
            />
            <datalist id="hero-areas">
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <button type="submit" className="rounded-xl bg-trust-blue px-6 py-3 font-display font-extrabold text-white shadow-sm hover:bg-night-blue">
              Find a flat
            </button>
          </form>

          {areas.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink/70">
              Popular now:
              {areas.slice(0, 5).map((a) => (
                <Link
                  key={a}
                  to={`/compounds?area=${encodeURIComponent(a)}`}
                  className="rounded-full bg-white px-3 py-1 font-bold text-trust-blue shadow-sm hover:bg-trust-blue hover:text-white"
                >
                  {a}
                </Link>
              ))}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold">
            <Link to="/compounds?view=map" className="text-trust-blue hover:underline">
              Browse on the map
            </Link>
            {user ? (
              <Link to={homePathFor(user.role)} className="text-trust-blue hover:underline">
                Go to your {user.role === "ADMIN" ? "panel" : "space"}
              </Link>
            ) : (
              <Link to="/register?as=landlord" className="text-trust-blue hover:underline">
                I'm a landlord: list free
              </Link>
            )}
          </div>
        </div>

        <Reveal className="mx-auto w-full max-w-lg lg:max-w-none">
          <HeroScene className="h-auto w-full" />
        </Reveal>
      </div>
    </section>
  );
}

function Ticker() {
  const items = (
    <>
      {TICKER.map((text) => (
        <span key={text} className="flex items-center gap-8 whitespace-nowrap pr-8 font-display text-sm font-extrabold text-white">
          {text}
          <span className="h-1.5 w-1.5 rounded-full bg-direct-green" aria-hidden="true" />
        </span>
      ))}
    </>
  );
  return (
    <div className="overflow-hidden bg-night-blue py-3" aria-label="Why DirectLet">
      <div className="dl-marquee">
        <div className="flex">{items}</div>
        <div className="dl-marquee-dup flex" aria-hidden="true">
          {items}
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: <IconFind />,
      title: "Find it",
      text: "Browse compounds as a list or on the map. See which flats are vacant, the price per year and the exact location.",
    },
    {
      icon: <IconAsk />,
      title: "Ask the owner",
      text: "Message the owner, or request a viewing with no account. You get answers from the person who decides.",
    },
    {
      icon: <IconView />,
      title: "See it, then pay",
      text: "Get directions and see the flat in person. Pay only after you have seen it and met the owner.",
    },
  ];
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className={page}>
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-wide text-trust-blue">For house hunters</p>
          <h2 className={`${sectionTitle} mt-2 max-w-2xl`}>Three steps from "I like this one" to the keys</h2>
        </Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 120}>
              <div className="h-full rounded-2xl border border-mist bg-white p-6 shadow-sm">
                {step.icon}
                <h3 className="mt-4 font-display text-xl font-extrabold text-night-blue">{step.title}</h3>
                <p className="mt-2 text-ink/80">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/compounds" className="rounded-xl bg-trust-blue px-6 py-3 font-display font-extrabold text-white hover:bg-night-blue">
              Browse compounds
            </Link>
            <Link to="/compounds?view=map" className="rounded-xl border-2 border-trust-blue px-6 py-3 font-display font-extrabold text-trust-blue hover:bg-trust-blue hover:text-white">
              See the map
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// Agents often take 10% to 20% of a year's rent. The slider shows what that
// means for the rent in front of you.
function Savings() {
  const [rent, setRent] = useState(1_500_000);
  const low = useAnimatedNumber(rent * 0.1);
  const high = useAnimatedNumber(rent * 0.2);
  const agentTotalWidth = 100;
  const directWidth = (rent / (rent * 1.2)) * 100;

  return (
    <section className="bg-night-blue py-14 text-white sm:py-20">
      <div className={`${page} grid items-center gap-10 lg:grid-cols-2`}>
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-wide text-direct-green">Keep your money</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">What the agent takes, you keep</h2>
          <p className="mt-4 max-w-md text-white/80">
            Agents often charge 10% to 20% of a year's rent, before the extras. Drag the slider to see what that is on
            the flat you want.
          </p>
          <p className="mt-3 text-xs text-white/60">An estimate. Agent fees vary from one deal to the next.</p>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-2xl bg-white p-5 text-ink shadow-xl sm:p-7">
            <label htmlFor="rent-slider" className="text-sm font-bold text-ink/70">
              A flat that costs per year
            </label>
            <p className="font-display text-3xl font-extrabold tabular-nums text-night-blue">{naira(rent)}</p>
            <input
              id="rent-slider"
              type="range"
              min={300_000}
              max={10_000_000}
              step={100_000}
              value={rent}
              onChange={(e) => setRent(Number(e.target.value))}
              aria-valuetext={naira(rent)}
              className="mt-3 w-full accent-[#1DB954]"
            />
            <div className="flex justify-between text-xs text-ink/50">
              <span>NGN 300K</span>
              <span>NGN 10M</span>
            </div>

            <div className="mt-6 space-y-3">
              <div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Through an agent</span>
                  <span className="tabular-nums">up to {naira(Math.round(rent * 1.2))}</span>
                </div>
                <div className="mt-1 h-4 overflow-hidden rounded-full bg-mist">
                  <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${agentTotalWidth}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm font-bold">
                  <span>On DirectLet</span>
                  <span className="tabular-nums">{naira(rent)}</span>
                </div>
                <div className="mt-1 h-4 overflow-hidden rounded-full bg-mist">
                  <div className="h-full rounded-full bg-direct-green transition-all duration-500" style={{ width: `${directWidth}%` }} />
                </div>
              </div>
            </div>

            <p className="mt-5 rounded-xl bg-direct-green/10 p-4 text-sm font-bold text-night-blue">
              You could keep{" "}
              <span className="font-display text-lg font-extrabold tabular-nums text-direct-green">
                {naira(Math.round(low / 1000) * 1000)} to {naira(Math.round(high / 1000) * 1000)}
              </span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ForLandlords() {
  const points = [
    "Add compounds with 20 or 30 flats each, and pin them on the map",
    "See at a glance which flats are vacant and which are let",
    "Add a tenant with an invite link. Rent bills itself, period after period",
    "Tenants record payments with proof. You confirm, and a PDF receipt is issued",
    "Reminders for rent that is due or overdue, with exact totals",
    "Viewing requests, complaints and messages in one place",
  ];
  return (
    <section className="bg-mist py-14 sm:py-20">
      <div className={`${page} grid items-center gap-10 lg:grid-cols-2`}>
        <Reveal>
          <DashboardMock />
        </Reveal>
        <Reveal delay={120}>
          <p className="text-sm font-bold uppercase tracking-wide text-trust-blue">For landlords</p>
          <h2 className={`${sectionTitle} mt-2`}>Run your compounds without the paperwork</h2>
          <ul className="mt-5 flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-ink/90">
                <Check />
                {point}
              </li>
            ))}
          </ul>
          <Link to="/register?as=landlord" className="mt-6 inline-block rounded-xl bg-trust-blue px-6 py-3 font-display font-extrabold text-white hover:bg-night-blue">
            List your compound free
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function ForTenants() {
  const points = [
    "See what you owe and when it is due",
    "Record a payment with a screenshot as proof",
    "Download a receipt any time",
    "Raise a complaint and follow its status",
    "Message your landlord in the same place",
  ];
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className={`${page} grid items-center gap-10 lg:grid-cols-2`}>
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-wide text-trust-blue">For tenants</p>
          <h2 className={`${sectionTitle} mt-2`}>Your rent, your receipts, one place</h2>
          <p className="mt-3 max-w-lg text-ink/80">
            Your landlord adds you and sends an invite link. Open it, set a password, and you are in.
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-ink/90">
                <Check />
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120}>
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border-8 border-night-blue bg-mist p-4 shadow-xl">
            <p className="font-display text-lg font-extrabold text-night-blue">Palm Court (Flat 1)</p>
            <p className="text-sm text-ink/70">NGN 1,200,000 / year</p>
            <div className="mt-3 rounded-xl border-l-4 border-trust-blue bg-white p-3">
              <p className="font-display text-sm font-extrabold text-night-blue">Due in 10 days</p>
              <p className="text-xs text-ink/70">NGN 1,200,000 for the period starting 2 Nov</p>
            </div>
            <div className="mt-3 rounded-xl bg-white p-3">
              <p className="text-xs font-bold text-ink/60">Last payment</p>
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-extrabold text-night-blue">NGN 1,200,000</p>
                <span className="text-xs font-bold text-direct-green">CONFIRMED</span>
              </div>
              <p className="mt-1 text-xs font-bold text-trust-blue">Download receipt</p>
            </div>
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-ink/40">Example</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Featured({ properties }: { properties: PublicProperty[] }) {
  if (properties.length === 0) return null;
  return (
    <section className="bg-mist py-14 sm:py-20">
      <div className={page}>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-trust-blue">Available now</p>
              <h2 className={`${sectionTitle} mt-2`}>Compounds with flats open</h2>
            </div>
            <Link to="/compounds" className="font-bold text-trust-blue hover:underline">
              See all compounds
            </Link>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p, i) => (
            <Reveal key={p.id} delay={i * 100}>
              <Link to={`/compounds/${p.id}`} className="group block overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="h-36">
                  <CompoundThumb seed={i + p.name.length} />
                </div>
                <div className="p-5">
                  <p className="font-display text-lg font-extrabold text-night-blue">{p.name}</p>
                  <p className="text-sm text-ink/70">
                    {p.area}, {p.city}
                    {bedrooms(p.bedroomsMin, p.bedroomsMax) ? ` / ${bedrooms(p.bedroomsMin, p.bedroomsMax)}` : ""}
                  </p>
                  {p.priceFrom && (
                    <p className="mt-2 font-display font-extrabold text-trust-blue">
                      {(p.vacantUnitCount ?? 0) > 1 ? "From " : ""}
                      {formatRent(p.priceFrom.amount, p.priceFrom.frequency)}
                    </p>
                  )}
                  <p className="mt-1 text-sm font-bold text-direct-green">
                    {p.vacantUnitCount} flat{p.vacantUnitCount === 1 ? "" : "s"} available
                  </p>
                  <p className="mt-3 text-sm font-bold text-trust-blue group-hover:underline">See flats and directions</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Safety() {
  const tips = [
    ["See it first", "View the flat in person before you pay anything."],
    ["Meet the owner", "Never pay a viewing fee or deposit to someone you have not met."],
    ["Keep it written", "Chat and pay through proof you can show later. Every payment here gets a receipt."],
    ["Report fakes", "If a listing looks wrong, tell us. We take down listings that are reported as fake."],
  ];
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className={page}>
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-wide text-trust-blue">Stay safe</p>
          <h2 className={`${sectionTitle} mt-2 max-w-2xl`}>Fake listings are everywhere. Here is how to beat them</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tips.map(([title, text], i) => (
            <Reveal key={title} delay={i * 100}>
              <div className="h-full rounded-2xl bg-mist/60 p-5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-direct-green font-display font-extrabold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-display text-lg font-extrabold text-night-blue">{title}</h3>
                <p className="mt-1 text-sm text-ink/80">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-6 max-w-2xl rounded-xl border-l-4 border-trust-blue bg-white p-4 text-sm text-ink/80 shadow-sm">
            We are building owner verification. Until it is live, treat every listing with care, and do not pay before
            you have seen the flat.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const FAQ = [
  [
    "Is DirectLet free?",
    "Browsing, messaging owners and listing your compounds are free today. DirectLet does not charge agent commission.",
  ],
  [
    "Does DirectLet handle my rent money?",
    "No. You pay the owner directly. DirectLet keeps the record: the tenant logs the payment with proof, the owner confirms it, and a receipt is issued.",
  ],
  [
    "Do I need an account to look at flats?",
    "No. You can browse and request a viewing without one. Make a free account when you want to message an owner.",
  ],
  [
    "How do I know a listing is real?",
    "View the flat in person and never pay before you have met the owner. Owner verification is coming. Until then, we take down listings that are reported as fake.",
  ],
  [
    "I am a tenant already. How do I get in?",
    "Your landlord adds you and sends an invite link. Open it, set a password, and you can see your rent, pay with proof and raise complaints.",
  ],
  [
    "I manage many flats. Can I list them all?",
    "Yes. Add as many compounds and flats as you manage. You only ever see your own.",
  ],
];

function Faq() {
  return (
    <section className="bg-mist py-14 sm:py-20">
      <div className={`${page} max-w-3xl`}>
        <Reveal>
          <h2 className={sectionTitle}>Questions people ask</h2>
        </Reveal>
        <div className="mt-6 flex flex-col gap-3">
          {FAQ.map(([question, answer]) => (
            <Reveal key={question}>
              <details className="group rounded-xl bg-white p-4 shadow-sm open:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display font-extrabold text-night-blue [&::-webkit-details-marker]:hidden">
                  {question}
                  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-trust-blue transition-transform group-open:rotate-180" aria-hidden="true">
                    <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <p className="mt-3 text-ink/80">{answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingBanner() {
  const user = useAuthStore((s) => s.user);
  return (
    <section className="overflow-hidden bg-night-blue text-white">
      <div className={`${page} grid items-center gap-6 py-14 sm:py-20 md:grid-cols-[1fr_auto]`}>
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold sm:text-5xl">Find it. Call the owner.</h2>
          <p className="mt-3 max-w-xl text-white/80">Your next home is a message away, and nobody is standing in between.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/compounds" className="rounded-xl bg-direct-green px-6 py-3 font-display font-extrabold text-night-blue hover:bg-white">
              Find a flat
            </Link>
            {!user && (
              <Link to="/register?as=landlord" className="rounded-xl border-2 border-white px-6 py-3 font-display font-extrabold text-white hover:bg-white hover:text-night-blue">
                List your compound free
              </Link>
            )}
          </div>
        </Reveal>
        <RisingArrow className="mx-auto h-40 w-40 sm:h-56 sm:w-56" />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink py-8 text-sm text-white/70">
      <div className={`${page} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="font-display text-lg font-extrabold text-white">DirectLet</p>
          <p>No Agent Wahala.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-bold">
          <Link to="/compounds" className="hover:text-white">Browse</Link>
          <Link to="/register?as=landlord" className="hover:text-white">List your compound</Link>
          <Link to="/login" className="hover:text-white">Log in</Link>
          <Link to="/register" className="hover:text-white">Sign up</Link>
        </nav>
        <p className="w-full text-xs text-white/50">© {YEAR} DirectLet. Rental homes in Nigeria, direct from the owner.</p>
      </div>
    </footer>
  );
}

export default function Home() {
  const [properties, setProperties] = useState<PublicProperty[]>([]);

  useEffect(() => {
    // The landing page works without this; it only adds live listings and areas.
    listPublicProperties()
      .then((data) => setProperties(data.properties))
      .catch(() => undefined);
  }, []);

  const open = useMemo(() => properties.filter((p) => (p.vacantUnitCount ?? 0) > 0), [properties]);
  const areas = useMemo(() => [...new Set(open.map((p) => p.area))], [open]);

  return (
    <div>
      <Hero areas={areas} />
      <Ticker />
      <HowItWorks />
      <Savings />
      <ForLandlords />
      <ForTenants />
      <Featured properties={open.slice(0, 3)} />
      <Safety />
      <Faq />
      <ClosingBanner />
      <Footer />
    </div>
  );
}
