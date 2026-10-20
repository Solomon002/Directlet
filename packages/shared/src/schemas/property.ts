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

export const updatePropertySchema = createPropertySchema.partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
