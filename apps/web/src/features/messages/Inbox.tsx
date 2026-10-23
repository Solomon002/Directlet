import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router";
import {
  getConversation,
  getMessages,
  listConversations,
  roleLabels,
  sendMessage,
  usePolling,
  type ChatMessage,
  type ConversationSummary,
} from "./api";
import { useAuthStore } from "../../stores/authStore";
import { parseApiError } from "../../lib/errors";

const THREAD_POLL_MS = 5000;
const LIST_POLL_MS = 15000;

function shortTime(iso: string) {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function ConversationList({
  conversations,
  activeId,
  basePath,
}: {
  conversations: ConversationSummary[];
  activeId?: string;
  basePath: string;
}) {
  if (conversations.length === 0) {
    return (
      <p className="p-4 text-sm text-ink">
        No messages yet. Open a listing and tap <span className="font-bold">Message landlord</span> to start one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-mist">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            to={`${basePath}/${c.id}`}
            className={`block px-4 py-3 hover:bg-mist/50 ${c.id === activeId ? "bg-mist" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-extrabold text-night-blue">{c.otherParty.fullName}</p>
              <span className="shrink-0 text-xs text-ink/60">{shortTime(c.lastMessageAt)}</span>
            </div>
            <p className="text-xs font-bold text-ink/60">
              {roleLabels[c.otherParty.role]} - {c.property.name}
              {c.unitLabel ? ` (${c.unitLabel})` : ""}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="truncate text-sm text-ink">{c.lastMessage?.body ?? ""}</p>
              {c.unread > 0 && (
                <span className="shrink-0 rounded-full bg-direct-green px-2 text-xs font-bold text-white">
                  {c.unread}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Thread({ conversationId, basePath }: { conversationId: string; basePath: string }) {
  const user = useAuthStore((s) => s.user);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setLoadError(null);
    getConversation(conversationId)
      .then(setConversation)
      .catch((err: unknown) => setLoadError(parseApiError(err).message));
  }, [conversationId]);

  // The first tick loads the thread; later ticks only fetch what is new.
  usePolling(
    () => {
      const last = messagesRef.current.at(-1)?.createdAt;
      getMessages(conversationId, last)
        .then((incoming) => {
          if (incoming.length === 0) return;
          setMessages((current) => {
            const seen = new Set(current.map((m) => m.id));
            return [...current, ...incoming.filter((m) => !seen.has(m.id))];
          });
        })
        .catch((err: unknown) => setLoadError(parseApiError(err).message));
    },
    THREAD_POLL_MS,
    [conversationId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const message = await sendMessage(conversationId, body);
      setMessages((current) => [...current, message]);
      setDraft("");
    } catch (err) {
      setSendError(parseApiError(err).message);
    } finally {
      setSending(false);
    }
  }

  // Enter sends; Shift+Enter makes a new line.
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (loadError) {
    return <p className="p-4 text-sm font-bold text-red-600">{loadError}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-mist bg-white px-4 py-3">
        <Link to={basePath} className="text-sm font-bold text-trust-blue md:hidden">
          All messages
        </Link>
        {conversation && (
          <>
            <p className="font-display font-extrabold text-night-blue">{conversation.otherParty.fullName}</p>
            <p className="text-xs font-bold text-ink/60">
              {roleLabels[conversation.otherParty.role]} - about{" "}
              <Link to={`/compounds/${conversation.property.id}`} className="text-trust-blue hover:underline">
                {conversation.property.name}
                {conversation.unitLabel ? ` (${conversation.unitLabel})` : ""}
              </Link>
            </p>
          </>
        )}
      </div>

      {user?.role === "HUNTER" && (
        <p className="bg-direct-green/10 px-4 py-2 text-xs text-ink">
          <span className="font-bold">Stay safe:</span> view the flat in person before paying anything, and
          never pay a "viewing fee" or deposit to someone you have not met.
        </p>
      )}

      <div className="flex-1 overflow-y-auto bg-mist/40 px-4 py-3">
        <ul className="flex flex-col gap-2">
          {messages.map((message) => (
            <li key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  message.mine ? "bg-trust-blue text-white" : "bg-white text-ink"
                }`}
              >
                {message.body}
                <span className={`mt-1 block text-right text-[10px] ${message.mine ? "text-white/70" : "text-ink/50"}`}>
                  {shortTime(message.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-mist bg-white p-3">
        {sendError && <p className="mb-2 text-sm font-bold text-red-600">{sendError}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            maxLength={2000}
            placeholder="Write a message"
            className="min-w-0 flex-1 resize-none rounded-lg border border-mist px-3 py-2 font-sans text-sm text-ink"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

// The whole inbox. On a phone it shows the list or one thread; from md up,
// both side by side. basePath is where this role's inbox lives.
export default function Inbox({ basePath }: { basePath: string }) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  usePolling(
    () => {
      listConversations()
        .then((list) => {
          setConversations(list);
          setLoadError(null);
        })
        .catch((err: unknown) => setLoadError(parseApiError(err).message))
        .finally(() => setLoading(false));
    },
    LIST_POLL_MS,
    [conversationId],
  );

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Messages</h1>
      <div className="mt-4 flex h-[70vh] min-h-[24rem] overflow-hidden rounded-xl bg-white shadow-sm">
        <div
          className={`w-full overflow-y-auto border-mist md:block md:w-80 md:shrink-0 md:border-r ${
            conversationId ? "hidden" : "block"
          }`}
        >
          {loading && <p className="p-4 text-sm text-ink">Loading...</p>}
          {loadError && <p className="p-4 text-sm font-bold text-red-600">{loadError}</p>}
          {!loading && !loadError && (
            <ConversationList conversations={conversations} activeId={conversationId} basePath={basePath} />
          )}
        </div>
        <div className={`min-w-0 flex-1 ${conversationId ? "block" : "hidden md:block"}`}>
          {conversationId ? (
            <Thread key={conversationId} conversationId={conversationId} basePath={basePath} />
          ) : (
            <p className="p-8 text-sm text-ink/60">Choose a conversation.</p>
          )}
        </div>
      </div>
    </div>
  );
}
