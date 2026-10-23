import { z } from "zod";

const messageBody = z
  .string()
  .trim()
  .min(1, "message is empty")
  .max(2000, "message is too long (2000 characters max)");

// A house hunter or tenant starts a chat about a property (and optionally a
// flat in it). A landlord starts one with a tenant through the tenancy.
export const startConversationSchema = z.object({
  propertyId: z.uuid().optional(),
  unitId: z.uuid().optional(),
  tenancyId: z.uuid().optional(),
  body: messageBody,
});

export const sendMessageSchema = z.object({
  body: messageBody,
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
