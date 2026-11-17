import type { Request, Response } from "express";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { requireHuman, captchaSiteKey } from "../../lib/captcha";
import * as authService from "./service";

// What the sign-up page needs to know: whether to show the robot check, and with which key.
export function config(_req: Request, res: Response) {
  res.status(200).json({ captchaSiteKey });
}

const REFRESH_COOKIE = "directlet_refresh";

// httpOnly: page scripts cannot read it. Strict: never sent from another site.
// path: only sent to the auth routes, not on every API call.
const cookieBase = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: env.REFRESH_COOKIE_PATH,
} as const;

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieBase, expires: expiresAt });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieBase);
}

function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function register(req: Request, res: Response) {
  // Before any account work, so a bot costs us a lookup and nothing else.
  await requireHuman(req.body.captchaToken, req.ip);
  const { captchaToken: _token, ...input } = req.body;
  const { user, accessToken, refreshToken, refreshExpiresAt } =
    await authService.register(input);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.status(201).json({ user, accessToken });
}

export async function login(req: Request, res: Response) {
  const { user, accessToken, refreshToken, refreshExpiresAt } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.status(200).json({ user, accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = readRefreshCookie(req);
  if (!token) {
    throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
  }

  try {
    const { user, accessToken, refreshToken, refreshExpiresAt } =
      await authService.rotateRefreshToken(token);
    setRefreshCookie(res, refreshToken, refreshExpiresAt);
    res.status(200).json({ user, accessToken });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) {
      clearRefreshCookie(res);
    }
    throw error;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function getInvite(req: Request, res: Response) {
  const info = await authService.getInviteInfo(req.params.token as string);
  res.status(200).json(info);
}

export async function acceptInvite(req: Request, res: Response) {
  const { password } = req.body as { password: string };
  const { user, accessToken, refreshToken, refreshExpiresAt } = await authService.acceptInvite(
    req.params.token as string,
    password,
  );
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.status(200).json({ user, accessToken });
}
