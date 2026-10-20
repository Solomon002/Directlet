import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { AppError } from "../../utils/AppError";
import type { RegisterInput, LoginInput } from "@directlet/shared";

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: "LANDLORD" | "TENANT";
}) {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

export async function registerLandlord(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "An account with this email already exists", "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
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
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.passwordHash) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
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
