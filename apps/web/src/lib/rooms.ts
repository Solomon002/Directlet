// A self-contained room (one room with its own bathroom) is stored as 0 bedrooms.
// People never say "0 bed", so it is shown as "Self-con".
export function bedroomLabel(bedrooms: number) {
  return bedrooms === 0 ? "Self-con" : `${bedrooms} bed`;
}

// "Self-con - 3 bed" for a compound that has several sizes.
export function bedroomRange(min?: number | null, max?: number | null) {
  if (min == null || max == null) return null;
  if (min === max) return bedroomLabel(min);
  return min === 0 ? `Self-con - ${max} bed` : `${min}-${max} bed`;
}
