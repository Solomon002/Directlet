import { z } from "zod";

export const paymentMethodValues = ["BANK_TRANSFER", "CASH", "OTHER"] as const;

export const createPaymentSchema = z.object({
  tenancyId: z.uuid(),
  amount: z.coerce.number().positive("amount must be positive"),
  method: z.enum(paymentMethodValues).default("BANK_TRANSFER"),
  paidAt: z.coerce.date(),
  reference: z.string().optional(),
});

export const rejectPaymentSchema = z.object({
  rejectionReason: z.string().min(2).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
