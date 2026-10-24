import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { JwtPayload } from "../../lib/jwt";
import { publiclyVisible } from "../public/service";
import type { StartConversationInput } from "@directlet/shared";

const MESSAGE_PAGE = 200;

function notFound() {
  return new AppError(404, "Conversation not found", "NOT_FOUND");
}

// Works out who the landlord and the other person are, and checks the starter
// is allowed to talk about this property.
async function resolveThread(user: JwtPayload, input: StartConversationInput) {
  if (user.role === "LANDLORD") {
    if (!input.tenancyId) {
      throw new AppError(400, "Choose the tenancy to message", "VALIDATION_ERROR");
    }
    const tenancy = await prisma.tenancy.findFirst({
      where: { id: input.tenancyId, unit: { property: { landlordId: user.sub } } },
      include: { unit: true },
    });
    if (!tenancy) {
      throw new AppError(404, "Tenancy not found", "NOT_FOUND");
    }
    return {
      propertyId: tenancy.unit.propertyId,
      unitId: tenancy.unitId,
      landlordId: user.sub,
      participantId: tenancy.tenantId,
    };
  }

  if (!input.propertyId) {
    throw new AppError(400, "Choose the property to ask about", "VALIDATION_ERROR");
  }

  // Anyone signed in can ask about a listed property. A tenant can also reach
  // their own landlord when the property is hidden from the marketplace.
  const property = await prisma.property.findFirst({
    where: {
      id: input.propertyId,
      OR: [publiclyVisible, { units: { some: { tenancies: { some: { tenantId: user.sub } } } } }],
    },
  });
  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }

  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, propertyId: property.id } });
    if (!unit) {
      throw new AppError(404, "Flat not found", "NOT_FOUND");
    }
  }

  return {
    propertyId: property.id,
    unitId: input.unitId ?? null,
    landlordId: property.landlordId,
    participantId: user.sub,
  };
}

// Starting a chat that already exists adds the message to it instead.
export async function startConversation(user: JwtPayload, input: StartConversationInput) {
  const thread = await resolveThread(user, input);
  const now = new Date();
  const readField = user.role === "LANDLORD" ? "landlordLastReadAt" : "participantLastReadAt";

  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: { propertyId_participantId: { propertyId: thread.propertyId, participantId: thread.participantId } },
      create: { ...thread, lastMessageAt: now, [readField]: now },
      update: { lastMessageAt: now, [readField]: now },
    });
    await tx.message.create({
      data: { conversationId: conversation.id, senderId: user.sub, body: input.body, createdAt: now },
    });
    return conversation;
  });
}

async function getMembership(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ landlordId: userId }, { participantId: userId }] },
  });
  if (!conversation) throw notFound();
  return { conversation, isLandlord: conversation.landlordId === userId };
}

// Unread = messages from the other side newer than my last-read time.
async function unreadByConversation(userId: string) {
  const rows = await prisma.$queryRaw<{ conversationId: string; unread: bigint }[]>`
    SELECT m."conversationId", COUNT(*) AS unread
    FROM "Message" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE m."senderId" <> ${userId}::uuid
      AND (
        (c."landlordId" = ${userId}::uuid AND (c."landlordLastReadAt" IS NULL OR m."createdAt" > c."landlordLastReadAt"))
        OR (c."participantId" = ${userId}::uuid AND (c."participantLastReadAt" IS NULL OR m."createdAt" > c."participantLastReadAt"))
      )
    GROUP BY m."conversationId"`;
  return new Map(rows.map((row) => [row.conversationId, Number(row.unread)]));
}

export async function unreadTotal(userId: string) {
  let total = 0;
  for (const count of (await unreadByConversation(userId)).values()) total += count;
  return total;
}

export async function listConversations(userId: string, onlyId?: string) {
  const [conversations, unread] = await Promise.all([
    prisma.conversation.findMany({
      where: { OR: [{ landlordId: userId }, { participantId: userId }], ...(onlyId ? { id: onlyId } : {}) },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        property: { select: { id: true, name: true, area: true, city: true } },
        landlord: { select: { id: true, fullName: true } },
        participant: { select: { id: true, fullName: true, role: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true } },
      },
    }),
    unreadByConversation(userId),
  ]);

  const unitIds = conversations.map((c) => c.unitId).filter((id): id is string => id !== null);
  const units = unitIds.length
    ? await prisma.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true, label: true } })
    : [];
  const unitLabels = new Map(units.map((unit) => [unit.id, unit.label]));

  return conversations.map((c) => {
    const isLandlord = c.landlordId === userId;
    return {
      id: c.id,
      property: c.property,
      unitLabel: c.unitId ? (unitLabels.get(c.unitId) ?? null) : null,
      otherParty: isLandlord
        ? { id: c.participant.id, fullName: c.participant.fullName, role: c.participant.role }
        : { id: c.landlord.id, fullName: c.landlord.fullName, role: "LANDLORD" as const },
      lastMessage: c.messages[0] ?? null,
      lastMessageAt: c.lastMessageAt,
      unread: unread.get(c.id) ?? 0,
    };
  });
}

// Returns the thread and marks it read. "after" lets the page poll for only
// what is new since the last message it has.
export async function getMessages(userId: string, conversationId: string, after?: Date) {
  const { conversation, isLandlord } = await getMembership(userId, conversationId);

  const messages = after
    ? await prisma.message.findMany({
        where: { conversationId, createdAt: { gt: after } },
        orderBy: { createdAt: "asc" },
        take: MESSAGE_PAGE,
      })
    : (
        await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: MESSAGE_PAGE,
        })
      ).reverse();

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: isLandlord ? { landlordLastReadAt: new Date() } : { participantLastReadAt: new Date() },
  });

  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    mine: message.senderId === userId,
  }));
}

export async function sendMessage(userId: string, conversationId: string, body: string) {
  const { conversation, isLandlord } = await getMembership(userId, conversationId);
  const now = new Date();

  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId, senderId: userId, body, createdAt: now } }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: isLandlord
        ? { lastMessageAt: now, landlordLastReadAt: now }
        : { lastMessageAt: now, participantLastReadAt: now },
    }),
  ]);

  return { id: message.id, body: message.body, createdAt: message.createdAt, mine: true };
}

// The header of one thread: who it is with and what it is about.
export async function getConversation(userId: string, conversationId: string) {
  const [found] = await listConversations(userId, conversationId);
  if (!found) throw notFound();
  return found;
}
