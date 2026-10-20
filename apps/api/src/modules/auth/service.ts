import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { AppError } from "../../utils/AppError";
import type { RegisterInput, LoginInput } from "@directlet/shared";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: "LANDLORD" | "TENANT";
}) {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
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

export async function registerLandlord(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        phone: input.phone,
        role: "LANDLORD",
      },
    });

    const payload = { sub: user.id, role: user.role };
    return {
      user: toAuthUser(user),
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "An account with this email already exists", "EMAIL_TAKEN");
    }
    throw error;
  }
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

  const payload = { sub: user.id, role: user.role };
  return {
    user: toAuthUser(user),
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function refreshTokens(token: string) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token", "UNAUTHENTICATED");
  }

  // The role always comes from the database, never from the token.
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new AppError(401, "Invalid or expired refresh token", "UNAUTHENTICATED");
  }

  const newPayload = { sub: user.id, role: user.role };
  return {
    accessToken: signAccessToken(newPayload),
    refreshToken: signRefreshToken(newPayload),
  };
}
