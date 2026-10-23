import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import type { UserRole } from "../generated/prisma/enums";

export type JwtPayload = {
  sub: string;
  role: UserRole;
};

// A verified token also carries an id and expiry, used to rotate and revoke.
export type VerifiedToken = JwtPayload & { jti: string; exp: number };

const VALID_ROLES: readonly UserRole[] = ["LANDLORD", "TENANT", "HUNTER"];

const ISSUER = "directlet-api";
const ALGORITHM = "HS256";

type TokenType = "access" | "refresh";

function sign(
  payload: JwtPayload,
  type: TokenType,
  secret: string,
  expiresIn: string,
  jti: string,
): string {
  return jwt.sign({ role: payload.role, typ: type }, secret, {
    subject: payload.sub,
    issuer: ISSUER,
    algorithm: ALGORITHM,
    jwtid: jti,
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

function verify(token: string, type: TokenType, secret: string): VerifiedToken {
  // Only HS256 is accepted, and the token must be from us and of the right kind.
  const decoded = jwt.verify(token, secret, { algorithms: [ALGORITHM], issuer: ISSUER });

  if (
    typeof decoded === "string" ||
    decoded.typ !== type ||
    typeof decoded.sub !== "string" ||
    typeof decoded.jti !== "string" ||
    typeof decoded.exp !== "number" ||
    !VALID_ROLES.includes(decoded.role as UserRole)
  ) {
    throw new Error("Invalid token");
  }

  return { sub: decoded.sub, role: decoded.role as UserRole, jti: decoded.jti, exp: decoded.exp };
}

export function signAccessToken(payload: JwtPayload): string {
  return sign(payload, "access", env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN, randomUUID());
}

// The caller supplies the jti so it can be saved as the id of the database row.
export function signRefreshToken(
  payload: JwtPayload,
  jti: string,
): { token: string; expiresAt: Date } {
  const token = sign(payload, "refresh", env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN, jti);
  const decoded = jwt.decode(token) as { exp: number };
  return { token, expiresAt: new Date(decoded.exp * 1000) };
}

export function verifyAccessToken(token: string): JwtPayload {
  const { sub, role } = verify(token, "access", env.JWT_ACCESS_SECRET);
  return { sub, role };
}

export function verifyRefreshToken(token: string): VerifiedToken {
  return verify(token, "refresh", env.JWT_REFRESH_SECRET);
}
