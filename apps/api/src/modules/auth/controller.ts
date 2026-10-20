import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as authService from "./service";

export async function register(req: Request, res: Response) {
  const result = await authService.registerLandlord(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    throw new AppError(400, "refreshToken is required", "VALIDATION_ERROR");
  }
  const result = await authService.refreshTokens(refreshToken);
  res.status(200).json(result);
}
