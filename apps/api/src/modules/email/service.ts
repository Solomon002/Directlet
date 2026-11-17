import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { emailEnabled } from "../../lib/email";
import { sendVerificationEmail } from "../../lib/notify";
import { AppError } from "../../utils/AppError";

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Makes a fresh link and emails it. Any earlier link stops working. Only the hash is
// stored, so the token exists nowhere but in the email.
export async function startEmailVerification(user: { id: string; email: string; fullName: string }) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.emailVerification.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerification.create({
      data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS) },
    }),
  ]);
  sendVerificationEmail(user.email, user.fullName, token);
}

export async function resend(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, emailVerifiedAt: true },
  });
  if (!user) {
    throw new AppError(401, "Invalid or expired session", "UNAUTHENTICATED");
  }
  if (user.emailVerifiedAt) {
    return { alreadyVerified: true, emailEnabled };
  }

  const latest = await prisma.emailVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_AFTER_MS) {
    throw new AppError(429, "We just sent one. Give it a minute, and check your spam folder.", "RATE_LIMITED");
  }

  await startEmailVerification(user);
  return { alreadyVerified: false, emailEnabled };
}

export async function verify(token: string) {
  const row = await prisma.emailVerification.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "This link is invalid or has expired. Ask for a new one.", "INVALID_TOKEN");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerification.deleteMany({ where: { userId: row.userId } }),
  ]);
}
