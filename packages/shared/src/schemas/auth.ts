import { z } from "zod";

// A short list for now. A larger breached-password check comes before launch.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234",
  "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop",
  "iloveyou", "11111111", "00000000", "abc12345", "abcd1234",
  "welcome1", "welcome123", "admin123", "letmein123", "passw0rd",
  "p@ssw0rd", "monkey123", "football1", "nigeria123", "lagos1234", "directlet",
]);

// bcrypt only reads the first 72 bytes of a password.
const byteLength = (value: string) => new TextEncoder().encode(value).length;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "full name is too short")
    .max(100, "full name is too long"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "password must be at least 8 characters")
    .max(128, "password is too long")
    .refine((value) => byteLength(value) <= 72, "password is too long (72 bytes at most)")
    .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), "password is too common"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "phone number looks invalid")
    .optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password is required").max(128, "password is too long"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
