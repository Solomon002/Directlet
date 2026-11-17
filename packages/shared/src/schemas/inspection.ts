import { z } from "zod";

// The person asking is signed in, so their name and email come from their account.
// Only what the account does not have is asked for.
export const createInspectionRequestSchema = z.object({
  phone: z.string().trim().min(7, "phone is too short").max(20, "phone is too long"),
  message: z.string().trim().max(500, "keep the message under 500 characters").optional(),
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
