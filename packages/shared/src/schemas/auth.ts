import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(2, "full name is too short"),
  email: z.email(),
  password: z.string().min(8, "password must be at least 8 characters"),
  phone: z.string().min(7).optional(),
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
