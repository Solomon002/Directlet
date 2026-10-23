import { Router } from "express";
import { sendMessageSchema, startConversationSchema } from "@directlet/shared";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { messageRateLimiter } from "../../middleware/rateLimit";
import { asyncHandler } from "../../utils/asyncHandler";
import * as conversationController from "./controller";

export const conversationsRouter = Router();

conversationsRouter.use(authenticate);

conversationsRouter.get("/", asyncHandler(conversationController.list));
conversationsRouter.get("/unread-count", asyncHandler(conversationController.unreadCount));
conversationsRouter.post(
  "/",
  messageRateLimiter,
  validate(startConversationSchema),
  asyncHandler(conversationController.start),
);
conversationsRouter.get("/:conversationId", asyncHandler(conversationController.getOne));
conversationsRouter.get("/:conversationId/messages", asyncHandler(conversationController.messages));
conversationsRouter.post(
  "/:conversationId/messages",
  messageRateLimiter,
  validate(sendMessageSchema),
  asyncHandler(conversationController.send),
);
