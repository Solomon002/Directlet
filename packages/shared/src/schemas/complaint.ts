import { z } from "zod";

export const complaintStatusValues = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;

export const createComplaintSchema = z.object({
  tenancyId: z.uuid(),
  title: z.string().min(3, "title is too short").max(120, "title is too long"),
  description: z.string().min(10, "description is too short"),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(complaintStatusValues),
  landlordNote: z.string().optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
