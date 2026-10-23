import { z } from "zod";

export const createPropertySchema = z.object({
  name: z.string().min(2, "name is too short"),
  address: z.string().min(5, "address is too short"),
  area: z.string().min(2, "area is required"),
  city: z.string().min(2, "city is required"),
  state: z.string().min(2, "state is required"),
  description: z.string().optional(),
  isPublic: z.boolean().optional().default(true),
});

// Defaults are dropped before .partial(): Zod still applies them to missing
// keys, so an edit would otherwise silently make a hidden property public.
export const updatePropertySchema = createPropertySchema.extend({ isPublic: z.boolean() }).partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
