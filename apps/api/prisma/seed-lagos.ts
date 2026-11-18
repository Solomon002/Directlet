// Fills the database with realistic SAMPLE data for demos: Lagos landlords, compounds
// and flats at real Lagos areas, tenants, rent, receipts, complaints and reviews.
//
//   pnpm --filter @directlet/api seed:lagos             add the sample data
//   pnpm --filter @directlet/api seed:lagos -- --remove  delete exactly what it added
//
// Everything it creates uses an email ending in @sample.invalid (a reserved name that can
// never receive mail), so it can always be told apart from real people and removed.
// The names, compounds, phone numbers and prices are made up; the areas and main streets
// are real, and the map pins are approximate. Landlords are marked "verified" for the demo
// WITHOUT documents, so remove this data before real visitors arrive.
//
// SEED=123 makes a run repeatable. LANDLORDS=30 VERIFIED=20 change the size.
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { addRentPeriod } from "../src/lib/rentPeriod";

const SAMPLE_DOMAIN = "@sample.invalid";
const LANDLORD_COUNT = Number(process.env.LANDLORDS ?? 30);
const VERIFIED_COUNT = Number(process.env.VERIFIED ?? 20);
const LOGIN_FILE = new URL("../.seed-lagos-login.txt", import.meta.url);

// ---------- Removing ----------

async function remove() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SAMPLE_DOMAIN } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  console.log(`Removing ${ids.length} sample accounts and everything attached to them...`);
  if (ids.length === 0) return;

  const tenancyWhere = { OR: [{ tenantId: { in: ids } }, { unit: { property: { landlordId: { in: ids } } } }] };
  const paymentWhere = { OR: [{ tenancy: tenancyWhere }, { recordedById: { in: ids } }, { confirmedById: { in: ids } }] };

  const result = await prisma.$transaction(
    async (tx) => {
      const complaints = await tx.complaint.deleteMany({ where: { OR: [{ raisedById: { in: ids } }, { tenancy: tenancyWhere }] } });
      const viewings = await tx.inspectionRequest.deleteMany({
        where: { OR: [{ requesterId: { in: ids } }, { unit: { property: { landlordId: { in: ids } } } }] },
      });
      const receipts = await tx.receipt.deleteMany({ where: { payment: paymentWhere } });
      const payments = await tx.payment.deleteMany({ where: paymentWhere });
      const tenancies = await tx.tenancy.deleteMany({ where: tenancyWhere });
      const properties = await tx.property.deleteMany({ where: { landlordId: { in: ids } } });
      const users = await tx.user.deleteMany({ where: { id: { in: ids } } });
      return { complaints: complaints.count, viewings: viewings.count, receipts: receipts.count, payments: payments.count, tenancies: tenancies.count, properties: properties.count, users: users.count };
    },
    { timeout: 300_000, maxWait: 30_000 },
  );
  console.log("Removed:", result);
}

// ---------- Randomness ----------

const seed = Number(process.env.SEED ?? Math.floor(Math.random() * 2 ** 31));
let state = seed >>> 0;
function rand() {
  // mulberry32: small, fast, repeatable
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const chance = (p: number) => rand() < p;
function weighted<T>(options: readonly (readonly [T, number])[]) {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [value, weight] of options) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return options[options.length - 1][0];
}
function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = int(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);
const DAY = 86_400_000;
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const daysAgo = (days: number) => new Date(today.getTime() - days * DAY);

// ---------- Places: real Lagos areas, approximate centres, main streets ----------

type Tier = 1 | 2 | 3; // 1 = Ikoyi / VI / Lekki, 2 = mid-market mainland, 3 = budget
const AREAS: { name: string; lat: number; lng: number; tier: Tier; streets: string[] }[] = [
  { name: "Ikoyi", lat: 6.4531, lng: 3.4343, tier: 1, streets: ["Awolowo Road", "Bourdillon Road", "Glover Road", "Gerrard Road", "Kingsway Road", "Alexander Avenue"] },
  { name: "Victoria Island", lat: 6.4281, lng: 3.4219, tier: 1, streets: ["Adeola Odeku Street", "Ozumba Mbadiwe Avenue", "Akin Adesola Street", "Idejo Street", "Karimu Kotun Street"] },
  { name: "Lekki Phase 1", lat: 6.4478, lng: 3.4723, tier: 1, streets: ["Admiralty Way", "Fola Osibo Street", "Babatunde Anjous Avenue", "Dele Orisabiyi Street"] },
  { name: "Oniru", lat: 6.4393, lng: 3.4545, tier: 1, streets: ["Water Corporation Road", "Ligali Ayorinde Street", "Oniru Estate Road"] },
  { name: "Ajah", lat: 6.4698, lng: 3.5852, tier: 2, streets: ["Lekki-Epe Expressway", "Abraham Adesanya Road", "Badore Road"] },
  { name: "Sangotedo", lat: 6.4727, lng: 3.6406, tier: 2, streets: ["Lekki-Epe Expressway", "Monastery Road", "Sangotedo Main Road"] },
  { name: "Ikeja GRA", lat: 6.5806, lng: 3.3501, tier: 2, streets: ["Isaac John Street", "Oduduwa Crescent", "Remi Fani-Kayode Avenue", "Joel Ogunnaike Street"] },
  { name: "Opebi", lat: 6.5983, lng: 3.3589, tier: 2, streets: ["Opebi Road", "Allen Avenue", "Toyin Street", "Salvation Road"] },
  { name: "Maryland", lat: 6.5666, lng: 3.3639, tier: 2, streets: ["Mobolaji Bank Anthony Way", "Ikorodu Road", "Maryland Mall Road"] },
  { name: "Magodo", lat: 6.6196, lng: 3.3958, tier: 2, streets: ["Magodo Phase 1 Road", "Magodo Phase 2 Road", "Isheri Road"] },
  { name: "Gbagada", lat: 6.5558, lng: 3.3897, tier: 2, streets: ["Diya Street", "Gbagada Expressway", "Ifako-Gbagada Road", "Medina Estate Road"] },
  { name: "Ogudu", lat: 6.5767, lng: 3.3949, tier: 2, streets: ["Ogudu Road", "Ogudu GRA Road", "Kosofe Road"] },
  { name: "Yaba", lat: 6.5095, lng: 3.3711, tier: 2, streets: ["Herbert Macaulay Way", "Commercial Avenue", "Montgomery Road", "Hughes Avenue", "Akinhanmi Street"] },
  { name: "Surulere", lat: 6.5009, lng: 3.3569, tier: 2, streets: ["Adeniran Ogunsanya Street", "Bode Thomas Street", "Ogunlana Drive", "Akerele Street", "Randle Avenue"] },
  { name: "Ilupeju", lat: 6.5524, lng: 3.357, tier: 2, streets: ["Town Planning Way", "Ilupeju Bypass", "Ikorodu Road"] },
  { name: "Anthony", lat: 6.5654, lng: 3.3702, tier: 2, streets: ["Anthony Way", "Mobolaji Bank Anthony Way", "Oba Akinjobi Way"] },
  { name: "Apapa", lat: 6.4478, lng: 3.359, tier: 2, streets: ["Creek Road", "Burma Road", "Marine Road", "Liverpool Road"] },
  { name: "Ikorodu", lat: 6.6194, lng: 3.5105, tier: 3, streets: ["Lagos Road", "Ijede Road", "Igbogbo Road", "Odogunyan Road"] },
  { name: "Festac Town", lat: 6.4663, lng: 3.279, tier: 3, streets: ["21 Road", "Second Avenue", "Fifth Avenue", "Festac Link Road"] },
  { name: "Isolo", lat: 6.5222, lng: 3.3205, tier: 3, streets: ["Ago Palace Way", "Okota Road", "Osolo Way"] },
  { name: "Oshodi", lat: 6.5558, lng: 3.3436, tier: 3, streets: ["Oshodi-Apapa Expressway", "Mafoluku Road", "Cappa Road"] },
  { name: "Ojodu Berger", lat: 6.6439, lng: 3.3578, tier: 3, streets: ["Ojodu-Berger Road", "Isheri Road", "Ikorodu Road"] },
  { name: "Egbeda", lat: 6.5963, lng: 3.2976, tier: 3, streets: ["Idimu Road", "Egbeda-Idimu Road", "Akowonjo Road"] },
  { name: "Agege", lat: 6.6224, lng: 3.319, tier: 3, streets: ["Old Abeokuta Road", "Agege Motor Road", "Pen Cinema Road"] },
  { name: "Mushin", lat: 6.533, lng: 3.3534, tier: 3, streets: ["Agege Motor Road", "Ojuwoye Road", "Idi-Oro Street"] },
  { name: "Ketu", lat: 6.5937, lng: 3.3841, tier: 3, streets: ["Ketu-Ikosi Road", "Alapere Road", "Ikorodu Road"] },
  { name: "Ojota", lat: 6.5852, lng: 3.3813, tier: 3, streets: ["Ikorodu Road", "Ogudu Road", "Ojota Expressway"] },
  { name: "Ebute Metta", lat: 6.4814, lng: 3.3814, tier: 3, streets: ["Murtala Muhammed Way", "Herbert Macaulay Way", "Brickfield Road"] },
  { name: "Ikotun", lat: 6.55, lng: 3.27, tier: 3, streets: ["Ikotun-Egbe Road", "Idimu Road", "Ejigbo Road"] },
];

// ---------- People ----------

const MALE = ["Adebayo", "Babatunde", "Chinedu", "Emeka", "Femi", "Gbenga", "Ibrahim", "Kayode", "Kunle", "Musa", "Obinna", "Olumide", "Segun", "Tunde", "Yusuf", "Chukwuemeka", "Ifeanyi", "Tochukwu", "Uche", "Wale", "Seyi", "Rotimi", "Dare", "Kelechi", "Nnamdi", "Sunday", "Tope", "Bayo", "Jide", "Lanre", "Ayodele", "Ikenna", "Emmanuel", "Kingsley"];
const FEMALE = ["Adaeze", "Aisha", "Bisi", "Chioma", "Folake", "Funmilayo", "Ifeoma", "Kemi", "Ngozi", "Omolara", "Ronke", "Titilayo", "Yetunde", "Zainab", "Blessing", "Chiamaka", "Damilola", "Hauwa", "Mariam", "Nkechi", "Oluwaseun", "Sade", "Temitope", "Uchenna", "Wuraola", "Amaka", "Bukola", "Ifunanya", "Ebere", "Halima", "Folasade", "Joy"];
const SURNAMES = ["Adeyemi", "Adebayo", "Okafor", "Okonkwo", "Balogun", "Bello", "Eze", "Ogunleye", "Ojo", "Olawale", "Abubakar", "Nwosu", "Adeleke", "Oladipo", "Akinola", "Ibrahim", "Mohammed", "Obi", "Ajayi", "Salami", "Lawal", "Danjuma", "Nwachukwu", "Ogundipe", "Olaniyan", "Afolabi", "Agbaje", "Okoro", "Chukwu", "Anyanwu", "Johnson", "Williams", "Cole", "Davies", "Coker", "Carew", "Oyebanji", "Ogunbiyi", "Onyekachi", "Ezeh", "Akande", "Fagbemi", "Idowu", "Sanni", "Usman", "Yakubu", "Nnadi", "Uzoma", "Ilori", "Olatunji"];
const TITLES = ["Chief", "Mrs", "Mr", "Dr", "Engr.", "Alhaji", "Barr.", "Pastor"];

const usedEmails = new Set<string>();
function makePerson(titled = false) {
  const female = chance(0.45);
  const first = pick(female ? FEMALE : MALE);
  const last = pick(SURNAMES);
  let email = `${first}.${last}`.toLowerCase();
  let n = 1;
  while (usedEmails.has(email + SAMPLE_DOMAIN)) email = `${first}.${last}${++n}`.toLowerCase();
  usedEmails.add(email + SAMPLE_DOMAIN);
  const title = titled && chance(0.35) ? `${female ? pick(["Mrs", "Dr", "Chief", "Engr."]) : pick(TITLES)} ` : "";
  return { fullName: `${title}${first} ${last}`, email: email + SAMPLE_DOMAIN };
}
const phone = () => `${pick(["0803", "0805", "0806", "0807", "0810", "0813", "0814", "0816", "0701", "0703", "0706", "0903", "0902"])}${String(int(0, 9999999)).padStart(7, "0")}`;

// ---------- Compounds and flats ----------

const NAME_A = ["Adebisi", "Okafor", "Bayview", "Emerald", "Lagoon", "Palmgrove", "Royal", "Golden", "Silverline", "Harmony", "Grace", "Hillcrest", "Sunrise", "Evergreen", "Heritage", "Peace", "Unity", "Crystal", "Oakwood", "Rosewood", "Lakeview", "Mainland", "Greenfield", "Cedar", "Ivory", "Regent", "Pinnacle", "Meridian", "Zenith", "Olive", "Ebony", "Amber", "Starlight", "Prestige", "Glory", "Favour", "Mercy", "Eden", "Zion", "Ayo", "Chukwu", "Bolanle", "Alade", "Tinuoye"];
const NAME_B = ["Court", "Apartments", "Villas", "Towers", "Residences", "Gardens", "Lodge", "Estate", "Heights", "Place", "Terrace", "Close", "Homes", "Mews"];
const FEATURES = [
  "24-hour water supply from a borehole",
  "prepaid meters in every flat",
  "gated compound with a security post",
  "tarred road and good drainage",
  "ample parking space",
  "standby generator for the common areas",
  "close to markets and public transport",
  "quiet, family-friendly neighbourhood",
  "CCTV at the entrance",
  "waste collection included",
  "fenced and well lit at night",
  "tiled floors and POP ceilings",
];

type UnitKind = "SELF" | "ONE" | "TWO" | "THREE";
const KIND_SPEC: Record<UnitKind, { bedrooms: number; baths: () => number; description: string; label: string }> = {
  SELF: { bedrooms: 0, baths: () => 1, label: "Room", description: "Self-contained room with its own bathroom and a small kitchenette." },
  ONE: { bedrooms: 1, baths: () => 1, label: "Flat", description: "One-bedroom flat with a living room, kitchen and bathroom." },
  TWO: { bedrooms: 2, baths: () => weighted([[2, 7], [1, 3]] as const), label: "Flat", description: "Two-bedroom flat with a spacious living room, kitchen and bathrooms." },
  THREE: { bedrooms: 3, baths: () => weighted([[3, 5], [2, 5]] as const), label: "Flat", description: "Three-bedroom flat with a master ensuite, living and dining area and kitchen." },
};

// Yearly rent ranges in Naira by tier and kind.
const RENT: Record<Tier, Record<UnitKind, [number, number]>> = {
  1: { SELF: [1_200_000, 2_200_000], ONE: [2_500_000, 5_000_000], TWO: [4_500_000, 9_000_000], THREE: [7_000_000, 16_000_000] },
  2: { SELF: [450_000, 900_000], ONE: [800_000, 1_600_000], TWO: [1_400_000, 3_000_000], THREE: [2_500_000, 5_000_000] },
  3: { SELF: [250_000, 500_000], ONE: [400_000, 900_000], TWO: [700_000, 1_600_000], THREE: [1_200_000, 2_800_000] },
};

// What a compound is mostly made of. Budget blocks are mostly rooms, estates mostly 2 and 3 beds.
function mixFor(tier: Tier): readonly (readonly [UnitKind, number])[] {
  const profile = weighted([["budget", tier === 3 ? 5 : 2], ["mixed", 4], ["family", tier === 1 ? 5 : 2]] as const);
  if (profile === "budget") return [["SELF", 6], ["ONE", 3], ["TWO", 1]] as const;
  if (profile === "family") return [["ONE", 1], ["TWO", 5], ["THREE", 4]] as const;
  return [["SELF", 2], ["ONE", 3], ["TWO", 4], ["THREE", 2]] as const;
}

// ---------- Text for complaints and reviews ----------

const COMPLAINTS = [
  ["Leaking kitchen tap", "The kitchen tap has been dripping for two weeks and the water bill is rising."],
  ["Faulty gate lock", "The compound gate lock is broken and the gate stays open at night."],
  ["No water since Monday", "The borehole pump has stopped and there has been no running water."],
  ["Prepaid meter error", "My prepaid meter keeps tripping and will not accept credit."],
  ["Noisy generator", "The generator runs very late and it is difficult to sleep."],
  ["Blocked drainage", "The drain beside the building is blocked and floods when it rains."],
  ["Bathroom door will not close", "The bathroom door has come off its hinge and needs repair."],
  ["Security light not working", "The security light at the stairs has been off for a week."],
] as const;
const REVIEW_GOOD = [
  "Clean compound and the landlord answers calls quickly. The flat matched the photos.",
  "Quiet street, steady water, and the security is reliable. Rent was exactly as advertised.",
  "Good value for the area. Repairs were done within a few days of asking.",
  "Spacious rooms and a tidy compound. Very easy to deal with the owner directly.",
  "No agent wahala at all. Paid direct, got a receipt, and moved in on the agreed date.",
];
const REVIEW_MIXED = [
  "Decent flat, but the generator is noisy and water pressure could be better.",
  "The flat is fine but parking is tight in the evenings.",
  "Good location. The finishing was a bit rough in places and one repair took long.",
];
const REVIEW_BAD = [
  "The listing said power was steady but outages are frequent. Disappointing.",
  "The final price was higher than advertised once the extra charges were added.",
];
const REPLIES = [
  "Thank you for the feedback. We are fixing this and appreciate your patience.",
  "Thanks for staying with us. The repairs have been scheduled.",
  "We appreciate the kind words and wish you a pleasant stay.",
];

// ---------- Seeding ----------

async function seedAll() {
  if ((await prisma.user.count({ where: { email: { endsWith: SAMPLE_DOMAIN } } })) > 0) {
    console.log("Sample data is already there. Run it with --remove first if you want to start again.");
    return;
  }
  console.log(`Seed ${seed}. Creating ${LANDLORD_COUNT} landlords (${VERIFIED_COUNT} verified)...`);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  // One shared demo password, never written in the repo: it goes to a file that git ignores.
  const password = randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(password);
  const now = new Date();

  type Row = Record<string, unknown>;
  const users: Row[] = [];
  const verifications: Row[] = [];
  const properties: Row[] = [];
  const units: Row[] = [];
  const tenancies: Row[] = [];
  const charges: Row[] = [];
  const payments: Row[] = [];
  const allocations: Row[] = [];
  const receipts: Row[] = [];
  const complaints: Row[] = [];
  const reviews: Row[] = [];
  const receiptNumbers = new Set<string>();
  const loginHints: string[] = [];
  let activeTenants = 0;

  const verifiedIndexes = new Set(shuffle([...Array(LANDLORD_COUNT).keys()]).slice(0, VERIFIED_COUNT));

  for (let l = 0; l < LANDLORD_COUNT; l++) {
    const person = makePerson(true);
    const landlordId = randomUUID();
    const joinedDaysAgo = int(45, 220);
    users.push({
      id: landlordId, email: person.email, passwordHash, fullName: person.fullName, phone: phone(), role: "LANDLORD",
      emailVerifiedAt: now, createdAt: daysAgo(joinedDaysAgo), updatedAt: now,
    });
    const verified = verifiedIndexes.has(l);
    if (verified) {
      const submitted = daysAgo(joinedDaysAgo - int(0, 3));
      const approved = new Date(submitted.getTime() + int(1, 9) * DAY);
      verifications.push({
        id: randomUUID(), userId: landlordId, status: "VERIFIED", landlordType: "INDIVIDUAL", submittedAt: submitted,
        reviewedAt: approved, verifiedAt: approved, reviewedById: admin?.id ?? null, createdAt: submitted, updatedAt: approved,
      });
    }
    if (loginHints.length < 6 && (verified ? loginHints.filter((h) => h.startsWith("verified")).length < 3 : loginHints.filter((h) => h.startsWith("unverified")).length < 1)) {
      loginHints.push(`${verified ? "verified landlord" : "unverified landlord"}: ${person.email}`);
    }

    const compoundCount = weighted([[1, 3], [2, 4], [3, 4], [4, 2], [5, 1]] as const);
    const usedNames = new Set<string>();
    for (let c = 0; c < compoundCount; c++) {
      const area = pick(AREAS);
      let name = `${pick(NAME_A)} ${pick(NAME_B)}`;
      while (usedNames.has(name)) name = `${pick(NAME_A)} ${pick(NAME_B)}`;
      usedNames.add(name);

      const propertyId = randomUUID();
      const createdAt = daysAgo(Math.max(1, joinedDaysAgo - int(0, 10)));
      properties.push({
        id: propertyId, landlordId, name,
        address: `${int(1, 98)} ${pick(area.streets)}`, area: area.name, city: "Lagos", state: "Lagos",
        description: `Well-kept compound in ${area.name}: ${shuffle([...FEATURES]).slice(0, int(2, 3)).join(", ")}.`,
        isPublic: true,
        // Pins are scattered around the area's centre, so they land in the right neighbourhood.
        latitude: area.lat + (rand() - 0.5) * 0.012, longitude: area.lng + (rand() - 0.5) * 0.012,
        createdAt, updatedAt: createdAt,
      });

      const unitCount = int(12, 40);
      const mix = mixFor(area.tier);
      const compoundFactor = 0.85 + rand() * 0.35;
      const occupancy = 0.55 + rand() * 0.37;
      const serviceCharge = area.tier === 1 ? int(100, 400) * 1000 : area.tier === 2 ? int(30, 150) * 1000 : int(0, 50) * 1000;
      const compoundTenants: { id: string; tenancyId: string; startedAt: Date }[] = [];
      const numbering = { room: 0, flat: 0 };

      for (let u = 0; u < unitCount; u++) {
        const kind = weighted(mix);
        const spec = KIND_SPEC[kind];
        const [low, high] = RENT[area.tier][kind];
        const yearly = (low + rand() * (high - low)) * compoundFactor;
        const frequency = weighted([["ANNUAL", 80], ["BIANNUAL", 12], ["MONTHLY", 8]] as const);
        const periods = frequency === "ANNUAL" ? 1 : frequency === "BIANNUAL" ? 2 : 12;
        const step = yearly > 2_000_000 ? 50_000 : 10_000;
        const rentAmount = roundTo(yearly / periods, frequency === "MONTHLY" ? 5_000 : step);
        const yearlyRounded = rentAmount * periods;
        const fee = (p: number, share: number) => (chance(p) ? roundTo(yearlyRounded * share, 5_000) : null);
        const number = spec.label === "Room" ? ++numbering.room : ++numbering.flat;
        const unitId = randomUUID();

        units.push({
          id: unitId, propertyId, label: `${spec.label} ${number}`, bedrooms: spec.bedrooms, bathrooms: spec.baths(),
          rentAmount, rentFrequency: frequency, description: spec.description,
          // Most landlords state these; a few leave them for "Ask landlord". No agency fee: no agents here.
          cautionDeposit: fee(0.75, 0.1), agreementFee: fee(0.7, 0.1),
          serviceCharge: chance(0.8) ? roundTo(serviceCharge, 5_000) : null, agencyFee: chance(0.8) ? 0 : null,
          availabilityConfirmedAt: daysAgo(int(0, 12)), createdAt, updatedAt: createdAt,
        });

        if (!chance(occupancy)) continue;

        // A tenant moved in during the current rent period, so exactly one charge is open.
        const periodDays = frequency === "ANNUAL" ? 365 : frequency === "BIANNUAL" ? 182 : 30;
        // Most tenants have paid; a few paid part, are waiting for confirmation, or are late. The
        // late ones moved in recently, so they are days overdue, not a year.
        const outcome = weighted([["paid", 86], ["part", 4], ["pending", 3], ["unpaid", 7]] as const);
        const startDate = daysAgo(outcome === "paid" ? int(3, periodDays - 5) : int(2, Math.min(21, periodDays - 5)));
        const expiry = addRentPeriod(startDate, frequency);
        const tenant = makePerson();
        const tenantId = randomUUID();
        const tenancyId = randomUUID();
        const hasLogin = activeTenants < 4 && verified && l === [...verifiedIndexes][0];
        if (hasLogin) {
          activeTenants++;
          loginHints.push(`tenant at ${name}: ${tenant.email}`);
        }
        users.push({
          id: tenantId, email: tenant.email, passwordHash: hasLogin ? passwordHash : null, fullName: tenant.fullName, phone: phone(),
          role: "TENANT", emailVerifiedAt: now, createdAt: new Date(startDate.getTime() - int(1, 4) * DAY), updatedAt: now,
        });
        tenancies.push({
          id: tenancyId, unitId, tenantId, rentAmount, rentFrequency: frequency, startDate, rentExpiryDate: expiry,
          status: "ACTIVE", createdAt: startDate, updatedAt: startDate,
        });
        compoundTenants.push({ id: tenantId, tenancyId, startedAt: startDate });

        const chargeId = randomUUID();
        const paidAmount = outcome === "paid" ? rentAmount : outcome === "part" ? roundTo(rentAmount / 2, 5_000) : 0;
        charges.push({
          id: chargeId, tenancyId, periodStart: startDate, periodEnd: expiry, dueDate: startDate, amount: rentAmount,
          amountPaid: paidAmount, createdAt: startDate, updatedAt: startDate,
        });
        if (outcome === "unpaid") continue;

        const paidAtRaw = new Date(startDate.getTime() + int(0, 6) * DAY);
        const paidAt = paidAtRaw > now ? now : paidAtRaw;
        const paymentId = randomUUID();
        const confirmed = outcome !== "pending";
        payments.push({
          id: paymentId, tenancyId, amount: outcome === "pending" ? rentAmount : paidAmount,
          method: weighted([["BANK_TRANSFER", 85], ["CASH", 12], ["OTHER", 3]] as const), paidAt,
          reference: `TRF${int(100000, 999999)}${int(1000, 9999)}`,
          status: confirmed ? "CONFIRMED" : "PENDING", recordedById: tenantId,
          confirmedById: confirmed ? landlordId : null, confirmedAt: confirmed ? new Date(paidAt.getTime() + DAY) : null,
          createdAt: paidAt, updatedAt: paidAt,
        });
        if (confirmed) {
          allocations.push({ id: randomUUID(), paymentId, rentChargeId: chargeId, amount: paidAmount, createdAt: paidAt });
          let receiptNumber = "";
          do {
            receiptNumber = `DL-${paidAt.getUTCFullYear()}${String(paidAt.getUTCMonth() + 1).padStart(2, "0")}-${randomBytes(3).toString("hex").toUpperCase()}`;
          } while (receiptNumbers.has(receiptNumber));
          receiptNumbers.add(receiptNumber);
          receipts.push({ id: randomUUID(), paymentId, receiptNumber, issuedAt: new Date(paidAt.getTime() + DAY) });
        }
      }

      // A few complaints from this compound's tenants.
      for (const tenant of compoundTenants) {
        if (!chance(0.04)) continue;
        const [title, description] = pick(COMPLAINTS);
        const status = weighted([["OPEN", 50], ["IN_PROGRESS", 25], ["RESOLVED", 25]] as const);
        const raised = new Date(Math.max(tenant.startedAt.getTime(), daysAgo(int(2, 60)).getTime()));
        complaints.push({
          id: randomUUID(), tenancyId: tenant.tenancyId, raisedById: tenant.id, title, description, status,
          landlordNote: status === "OPEN" ? null : "We have noted this and a technician will visit.",
          resolvedAt: status === "RESOLVED" ? new Date(raised.getTime() + int(1, 6) * DAY) : null,
          createdAt: raised, updatedAt: raised,
        });
      }

      // Reviews from some of the people who live there. They have rented, so they may review.
      if (compoundTenants.length >= 3 && chance(0.4)) {
        for (const tenant of shuffle([...compoundTenants]).slice(0, int(1, Math.min(4, compoundTenants.length)))) {
          const rating = weighted([[5, 30], [4, 40], [3, 20], [2, 7], [1, 3]] as const);
          const text = rating >= 4 ? pick(REVIEW_GOOD) : rating === 3 ? pick(REVIEW_MIXED) : pick(REVIEW_BAD);
          const written = new Date(Math.max(tenant.startedAt.getTime() + 5 * DAY, daysAgo(int(1, 40)).getTime()));
          const replied = chance(0.3);
          reviews.push({
            id: randomUUID(), propertyId, reviewerId: tenant.id, rating, comment: text,
            matchedPhotos: chance(rating >= 4 ? 0.95 : 0.4), priceAsStated: chance(rating >= 4 ? 0.9 : 0.35),
            landlordResponse: replied ? pick(REPLIES) : null, respondedAt: replied ? new Date(written.getTime() + 2 * DAY) : null,
            createdAt: written,
          });
        }
      }
    }
  }

  console.log(
    `Built in memory: ${users.length} users, ${properties.length} compounds, ${units.length} flats, ${tenancies.length} tenancies, ${payments.length} payments, ${complaints.length} complaints, ${reviews.length} reviews. Writing...`,
  );

  if (process.env.DRY === "1") {
    const verifiedCount = verifications.length;
    const byTier = (kind: number) => units.filter((unit) => unit.bedrooms === kind).length;
    console.log(`DRY RUN, nothing written. verified landlords: ${verifiedCount}, flats by size: self-con ${byTier(0)}, 1-bed ${byTier(1)}, 2-bed ${byTier(2)}, 3-bed ${byTier(3)}`);
    const perCompound = properties.map((p) => units.filter((u) => u.propertyId === p.id).length);
    console.log(`flats per compound: min ${Math.min(...perCompound)}, max ${Math.max(...perCompound)}`);
    return;
  }

  const chunk = <T,>(rows: T[], size = 1000) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
  await prisma.$transaction(
    async (tx) => {
      // Landlords before tenants is not needed (no links between them), but the order below
      // keeps every row's parents in place before the row itself.
      for (const rows of chunk(users)) await tx.user.createMany({ data: rows as never[] });
      for (const rows of chunk(verifications)) await tx.landlordVerification.createMany({ data: rows as never[] });
      for (const rows of chunk(properties)) await tx.property.createMany({ data: rows as never[] });
      for (const rows of chunk(units)) await tx.unit.createMany({ data: rows as never[] });
      for (const rows of chunk(tenancies)) await tx.tenancy.createMany({ data: rows as never[] });
      for (const rows of chunk(charges)) await tx.rentCharge.createMany({ data: rows as never[] });
      for (const rows of chunk(payments)) await tx.payment.createMany({ data: rows as never[] });
      for (const rows of chunk(allocations)) await tx.paymentAllocation.createMany({ data: rows as never[] });
      for (const rows of chunk(receipts)) await tx.receipt.createMany({ data: rows as never[] });
      for (const rows of chunk(complaints)) await tx.complaint.createMany({ data: rows as never[] });
      for (const rows of chunk(reviews)) await tx.review.createMany({ data: rows as never[] });
    },
    { timeout: 600_000, maxWait: 60_000 },
  );

  writeFileSync(
    LOGIN_FILE,
    `Sample data logins (this file is ignored by git; do not share it)\nPassword for all of these: ${password}\n\n${loginHints.join("\n")}\n`,
  );
  console.log("Done. Logins are in apps/api/.seed-lagos-login.txt");
}

async function main() {
  if (process.argv.includes("--remove")) await remove();
  else await seedAll();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
