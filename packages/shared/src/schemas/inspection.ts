import { z } from "zod";

export const createInspectionRequestSchema = z.object({
  name: z.string().min(2, "name is too short"),
  email: z.email(),
  phone: z.string().min(7, "phone is too short"),
  message: z.string().optional(),
  preferredDate: z.coerce.date().optional(),
});

export const scheduleInspectionSchema = z.object({
  scheduledFor: z.coerce.date(),
});

export const declineInspectionSchema = z.object({
  landlordNote: z.string().optional(),
});

export const convertInspectionSchema = z.object({
  tenantEmail: z.email(),
  tenantFullName: z.string().min(2, "tenant name is too short"),
  tenantPhone: z.string().min(7).optional(),
  startDate: z.coerce.date(),
});

export type CreateInspectionRequestInput = z.infer<typeof createInspectionRequestSchema>;
export type ScheduleInspectionInput = z.infer<typeof scheduleInspectionSchema>;
export type DeclineInspectionInput = z.infer<typeof declineInspectionSchema>;
export type ConvertInspectionInput = z.infer<typeof convertInspectionSchema>;
