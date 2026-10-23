import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

export type ConversationSummary = {
  id: string;
  property: { id: string; name: string; area: string; city: string };
  unitLabel: string | null;
  otherParty: { id: string; fullName: string; role: "LANDLORD" | "TENANT" | "HUNTER" };
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  lastMessageAt: string;
  unread: number;
};

export type ChatMessage = { id: string; body: string; createdAt: string; mine: boolean };

export async function listConversations() {
  const res = await api.get<{ conversations: ConversationSummary[] }>("/conversations");
  return res.data.conversations;
}

export async function getConversation(conversationId: string) {
  const res = await api.get<{ conversation: ConversationSummary }>(`/conversations/${conversationId}`);
  return res.data.conversation;
}

export async function getMessages(conversationId: string, after?: string) {
  const res = await api.get<{ messages: ChatMessage[] }>(`/conversations/${conversationId}/messages`, {
    params: after ? { after } : undefined,
  });
  return res.data.messages;
}

export async function sendMessage(conversationId: string, body: string) {
  const res = await api.post<{ message: ChatMessage }>(`/conversations/${conversationId}/messages`, { body });
  return res.data.message;
}

export async function startConversation(input: {
  propertyId?: string;
  unitId?: string;
  tenancyId?: string;
  body: string;
}) {
  const res = await api.post<{ conversation: { id: string } }>("/conversations", input);
  return res.data.conversation;
}

export const roleLabels: Record<ConversationSummary["otherParty"]["role"], string> = {
  LANDLORD: "Landlord",
  TENANT: "Tenant",
  HUNTER: "House hunter",
};

// Runs fn now and then every `ms`, skipping ticks while the tab is hidden so a
// phone in someone's pocket is not polling all day.
export function usePolling(fn: () => void, ms: number, deps: unknown[]) {
  useEffect(() => {
    fn();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") fn();
    }, ms);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Total unread messages, for the badge in the navigation.
export function useUnreadCount() {
  const user = useAuthStore((s) => s.user);
  const [unread, setUnread] = useState(0);
  usePolling(
    () => {
      if (!user) return;
      api
        .get<{ unread: number }>("/conversations/unread-count")
        .then((res) => setUnread(res.data.unread))
        .catch(() => undefined);
    },
    30000,
    [user?.id],
  );
  return user ? unread : 0;
}
