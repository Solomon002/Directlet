import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as conversationService from "./service";

function userId(req: Request): string {
  return req.user!.sub;
}

function parseAfter(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "Invalid 'after' timestamp", "VALIDATION_ERROR");
  }
  return date;
}

export async function list(req: Request, res: Response) {
  const conversations = await conversationService.listConversations(userId(req));
  res.status(200).json({ conversations });
}

export async function unreadCount(req: Request, res: Response) {
  const unread = await conversationService.unreadTotal(userId(req));
  res.status(200).json({ unread });
}

export async function start(req: Request, res: Response) {
  const conversation = await conversationService.startConversation(req.user!, req.body);
  res.status(201).json({ conversation: { id: conversation.id } });
}

export async function getOne(req: Request, res: Response) {
  const conversation = await conversationService.getConversation(
    userId(req),
    req.params.conversationId as string,
  );
  res.status(200).json({ conversation });
}

export async function messages(req: Request, res: Response) {
  const messages = await conversationService.getMessages(
    userId(req),
    req.params.conversationId as string,
    parseAfter(req.query.after),
  );
  res.status(200).json({ messages });
}

export async function send(req: Request, res: Response) {
  const message = await conversationService.sendMessage(
    userId(req),
    req.params.conversationId as string,
    (req.body as { body: string }).body,
  );
  res.status(201).json({ message });
}
