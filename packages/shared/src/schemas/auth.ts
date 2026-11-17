import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(2, "full name is too short"),
  email: z.email(),
  password: z.string().min(8, "password must be at least 8 characters"),
  phone: z.string().min(7).optional(),
  // Tenants never self-register; a landlord invites them.
  accountType: z.enum(["LANDLORD", "HUNTER"]).default("LANDLORD"),
  // The answer from the "are you a robot" check. Required when the site has it switched on.
  captchaToken: z.string().min(10).max(4096).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "password is required"),
});

export const acceptInviteSchema = z.object({
  password: z.string().min(8, "password must be at least 8 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
