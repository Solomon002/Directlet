import { z } from "zod";

export const rentFrequencyValues = ["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL"] as const;

// A one-off fee on top of the rent. Blank or null means "not said" (the public pages
// show "Ask landlord"); 0 means there is no such fee.
const optionalFee = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().min(0, "a fee cannot be negative").nullable(),
);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : new Date(value as string)),
  z.date().nullable(),
);

export const createUnitSchema = z.object({
  label: z.string().min(1, "label is required"),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().int().min(0).optional(),
  rentAmount: z.coerce.number().positive("rent amount must be positive"),
  rentFrequency: z.enum(rentFrequencyValues).default("ANNUAL"),
  description: z.string().optional(),
  cautionDeposit: optionalFee.optional(),
  agreementFee: optionalFee.optional(),
  serviceCharge: optionalFee.optional(),
  agencyFee: optionalFee.optional(),
  // For a flat that is let now but will be free on this date.
  availableFrom: optionalDate.optional(),
});

// Defaults are dropped before .partial(): Zod still applies them to missing
// keys, so an edit would otherwise silently reset rentFrequency to ANNUAL.
export const updateUnitSchema = createUnitSchema
  .extend({ rentFrequency: z.enum(rentFrequencyValues) })
  .partial();

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
