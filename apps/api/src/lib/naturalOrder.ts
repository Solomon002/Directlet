// Flats are named like "Flat 2" and "Flat 10". Sorted as plain text "Flat 10" comes before
// "Flat 2"; this orders them the way a person would (by the number inside the name).
export function byLabel(a: { label: string }, b: { label: string }) {
  return a.label.localeCompare(b.label, "en", { numeric: true, sensitivity: "base" });
}
