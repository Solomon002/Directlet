import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { AppError } from "../../utils/AppError";
import type { UserRole } from "../../generated/prisma/enums";
import type { RegisterInput, LoginInput } from "@directlet/shared";

// A used refresh token that comes back within this window is treated as a network
// retry. After it, a replayed token is treated as theft.
const REUSE_GRACE_MS = 10 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}) {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

function assertNotSuspended(user: { suspendedAt: Date | null }) {
  if (user.suspendedAt) {
    throw new AppError(403, "This account is suspended. Contact DirectLet support.", "ACCOUNT_SUSPENDED");
  }
}

function unauthenticated() {
  return new AppError(401, "Invalid or expired session", "UNAUTHENTICATED");
}

// A real hash of a random value, built once. Login compares against it when the
// email does not exist, so the response takes the same time either way.
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash() {
  dummyHashPromise ??= hashPassword(randomUUID());
  return dummyHashPromise;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

// Saves a new refresh token row and returns both tokens. The row id is the token jti.
async function issueTokens(user: { id: string; role: UserRole }, familyId: string = randomUUID()) {
  const jti = randomUUID();
  const payload = { sub: user.id, role: user.role };
  const refresh = signRefreshToken(payload, jti);

  await prisma.refreshToken.create({
    data: { id: jti, userId: user.id, familyId, expiresAt: refresh.expiresAt },
  });

  return {
    accessToken: signAccessToken(payload),
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
}

// Deletes every token in a family. A deleted token cannot be mistaken for a retry.
async function deleteFamily(familyId: string) {
  await prisma.refreshToken.deleteMany({ where: { familyId } });
}

export async function register(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user
    .create({
      data: {
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        phone: input.phone,
        role: input.accountType,
      },
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "An account with this email already exists", "EMAIL_TAKEN");
      }
      throw error;
    });

  const tokens = await issueTokens(user);
  return { user: toAuthUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  // Always run one password comparison, even for unknown emails and for
  // invited tenants who have no password yet.
  const hashToCheck = user?.passwordHash ?? (await getDummyHash());
  const valid = await comparePassword(input.password, hashToCheck);

  if (!user || !user.passwordHash || !valid) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }
  // Only after the password check, so this never reveals which emails exist.
  assertNotSuspended(user);

  const tokens = await issueTokens(user);
  return { user: toAuthUser(user), ...tokens };
}

export async function rotateRefreshToken(token: string) {
  let verified;
  try {
    verified = verifyRefreshToken(token);
  } catch {
    throw unauthenticated();
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: verified.jti } });
  if (!stored || stored.userId !== verified.sub) {
    throw unauthenticated();
  }

  // A used token replayed after the grace window means it was copied: delete the family.
  if (stored.revokedAt && Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
    console.warn("Refresh token reuse detected, family deleted", {
      userId: stored.userId,
      familyId: stored.familyId,
    });
    await deleteFamily(stored.familyId);
    throw unauthenticated();
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw unauthenticated();
  }

  // The role always comes from the database, never from the token.
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || user.suspendedAt) {
    throw unauthenticated();
  }

  if (!stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const tokens = await issueTokens(user, stored.familyId);
  return { user: toAuthUser(user), ...tokens };
}

export async function logout(token: string | undefined) {
  if (!token) return;

  try {
    const verified = verifyRefreshToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { id: verified.jti } });
    if (stored && stored.userId === verified.sub) {
      await deleteFamily(stored.familyId);
    }
  } catch {
    // An invalid or expired token needs no cleanup. Logout always succeeds.
  }
}

export async function getInviteInfo(token: string) {
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });

  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt.getTime() <= Date.now()) {
    throw new AppError(410, "This invite link is invalid or has expired", "INVITE_EXPIRED");
  }

  return { email: user.email, fullName: user.fullName };
}

export async function acceptInvite(token: string, password: string) {
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });

  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt.getTime() <= Date.now()) {
    throw new AppError(410, "This invite link is invalid or has expired", "INVITE_EXPIRED");
  }
  assertNotSuspended(user);

  const passwordHash = await hashPassword(password);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, inviteToken: null, inviteExpiresAt: null },
  });

  const tokens = await issueTokens(updated);
  return { user: toAuthUser(updated), ...tokens };
}
