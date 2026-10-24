// Plain words, as the brand manual asks: "/ year", never "/ annual".
const PER_PERIOD: Record<string, string> = {
  MONTHLY: "month",
  QUARTERLY: "quarter",
  BIANNUAL: "6 months",
  ANNUAL: "year",
};

export function naira(amount: string | number) {
  return `NGN ${Number(amount).toLocaleString()}`;
}

// "NGN 1,400,000 / year"
export function formatRent(amount: string | number, frequency: string) {
  return `${naira(amount)} / ${PER_PERIOD[frequency] ?? frequency.toLowerCase()}`;
}
