import { z } from "zod";

export const landlordTypeValues = ["INDIVIDUAL", "COMPANY"] as const;
export const cacTypeValues = ["RC", "BN", "IT"] as const;
export const verificationDocKindValues = ["ID", "OWNERSHIP", "CAC_CERTIFICATE"] as const;

export type LandlordTypeValue = (typeof landlordTypeValues)[number];
export type CacTypeValue = (typeof cacTypeValues)[number];
export type VerificationDocKindValue = (typeof verificationDocKindValues)[number];

// People type the number as "RC 123456", "RC-123456" or just "123456". Only the
// digits are kept; the type (RC, BN or IT) is chosen separately.
const cacNumber = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().replace(/^(RC|BN|IT)[\s-]*/i, "").replace(/\s+/g, "") : value),
  z.string().regex(/^\d{4,10}$/, "A CAC number is 4 to 10 digits, for example 1234567"),
);

// An individual owner needs no CAC number. A company, registered business name or
// trust must give one, with the name it is registered under.
export const submitVerificationSchema = z
  .object({
    landlordType: z.enum(landlordTypeValues),
    cacType: z.enum(cacTypeValues).optional(),
    cacNumber: cacNumber.optional(),
    registeredName: z.string().trim().min(2).max(150).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.landlordType !== "COMPANY") return;
    if (!value.cacType) ctx.addIssue({ code: "custom", path: ["cacType"], message: "Choose RC, BN or IT" });
    if (!value.cacNumber) ctx.addIssue({ code: "custom", path: ["cacNumber"], message: "Enter the CAC number" });
    if (!value.registeredName) {
      ctx.addIssue({ code: "custom", path: ["registeredName"], message: "Enter the registered name" });
    }
  });

export const rejectVerificationSchema = z.object({
  reason: z.string().trim().min(3, "Say what is wrong so the landlord can fix it").max(300),
});

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>;
