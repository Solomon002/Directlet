import { z } from "zod";

export const createTenancySchema = z.object({
  unitId: z.uuid(),
  tenantEmail: z.email(),
  tenantFullName: z.string().min(2, "tenant name is too short"),
  tenantPhone: z.string().min(7).optional(),
  startDate: z.coerce.date(),
});

export type CreateTenancyInput = z.infer<typeof createTenancySchema>;
