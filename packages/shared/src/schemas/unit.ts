import { z } from "zod";

export const rentFrequencyValues = ["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL"] as const;

export const createUnitSchema = z.object({
  label: z.string().min(1, "label is required"),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().int().min(0).optional(),
  rentAmount: z.coerce.number().positive("rent amount must be positive"),
  rentFrequency: z.enum(rentFrequencyValues).default("ANNUAL"),
  description: z.string().optional(),
});

// Defaults are dropped before .partial(): Zod still applies them to missing
// keys, so an edit would otherwise silently reset rentFrequency to ANNUAL.
export const updateUnitSchema = createUnitSchema
  .extend({ rentFrequency: z.enum(rentFrequencyValues) })
  .partial();

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
