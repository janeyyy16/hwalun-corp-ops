import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Plus, Search, Send, Smile, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import {
  getConversations,
  getCoworkers,
  getMessages,
  getReadReceipts,
  markConversationRead,
  sendMessage,
  startDirectConversation,
  startGroupConversation,
  subscribeToConversationMessages,
  subscribeToConversationParticipants,
  subscribeToNewMessages,
  subscribeToReactions,
  toggleReaction,
  type ConversationSummary,
  type Coworker,
  type Message,
  type Reaction,
  type ReadReceipt,
} from "@/lib/messaging";

export const Route = createFileRoute("/messages")({
  component: Messages,
});

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function conversationTitle(c: ConversationSummary): string {
  if (c.title) return c.title;
  if (c.otherParticipants.length === 0) return "Just you";
  return c.otherParticipants.map((p) => p.fullName).join(", ");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function aggregateReactions(reactions: Reaction[], myProfileId: string): { emoji: string; count: number; mine: boolean }[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const entry = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (r.profileId === myProfileId) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }
  return [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v }));
}

function Messages() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [receipts, setReceipts] = useState<ReadReceipt[] | null>(null);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showNew, setShowNew] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function reloadConversations() {
    setConversations(await getConversations());
  }

  useEffect(() => {
    reloadConversations();
    const unsubscribe = subscribeToNewMessages(() => reloadConversations());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setReactingTo(null);
    getMessages(activeId).then((m) => {
      if (!cancelled) setMessages(m);
    });
    getReadReceipts(activeId).then((r) => {
      if (!cancelled) setReceipts(r);
    });
    markConversationRead(activeId).then(reloadConversations);

    const unsubscribeMessages = subscribeToConversationMessages(activeId, (m) => {
      setMessages((prev) => (prev ? [...prev, m] : [m]));
      markConversationRead(activeId).then(reloadConversations);
    });
    const unsubscribeReactions = subscribeToReactions(() => {
      getMessages(activeId).then((m) => {
        if (!cancelled) setMessages(m);
      });
    });
    const unsubscribeParticipants = subscribeToConversationParticipants(activeId, () => {
      getReadReceipts(activeId).then((r) => {
        if (!cancelled) setReceipts(r);
      });
    });
    return () => {
      cancelled = true;
      unsubscribeMessages();
      unsubscribeReactions();
      unsubscribeParticipants();
    };
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!profile) return null;

  const canPostAnnouncement = profile.role.key === "admin" || profile.role.key === "super_admin";

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeId || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    await sendMessage(activeId, body);
  }

  async function handleReact(messageId: string, emoji: string) {
    setReactingTo(null);
    await toggleReaction(messageId, emoji);
    if (activeId) setMessages(await getMessages(activeId));
  }

  async function handleStartConversation(coworkerIds: string[], title: string | null) {
    const conversationId =
      coworkerIds.length === 1 ? await startDirectConversation(coworkerIds[0]) : await startGroupConversation(title, coworkerIds);
    setShowNew(false);
    await reloadConversations();
    setActiveId(conversationId);
  }

  const active = conversations?.find((c) => c.id === activeId) ?? null;

  return (
    <DashboardShell title="Messages" subtitle="Chat with your coworkers.">
      <div className="flex h-[calc(100vh-13rem)] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex w-72 shrink-0 flex-col border-r border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-sm font-bold text-ink">Conversations</h2>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              aria-label="New message"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-steel)] hover:bg-hover hover:text-[var(--color-primary)]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations?.map((c) => {
              const title = conversationTitle(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors ${
                    activeId === c.id ? "bg-[var(--color-primary)]/10" : "hover:bg-hover"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      c.isAnnouncement ? "bg-[#1c2024]" : "bg-[var(--color-primary)]"
                    }`}
                  >
                    {c.isAnnouncement ? <Megaphone className="h-4 w-4" /> : initials(title)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{title}</p>
                    <p className="truncate text-xs text-[var(--color-steel)]">{c.lastMessage ?? "No messages yet."}</p>
                  </div>
                  {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />}
                </button>
              );
            })}
            {conversations && conversations.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-steel)]">No conversations yet.</p>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {active ? (
            <>
              <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
                {active.isAnnouncement && <Megaphone className="h-4 w-4 text-[var(--color-steel)]" />}
                <h3 className="text-sm font-bold text-ink">{conversationTitle(active)}</h3>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-5 py-4">
                {messages?.map((m, i) => {
                  const mine = m.senderId === profile.id;
                  const reactions = aggregateReactions(m.reactions, profile.id);
                  const isLast = i === (messages?.length ?? 0) - 1;
                  return (
                    <div key={m.id} className={`flex flex-col pb-2 ${mine ? "items-end" : "items-start"}`}>
                      <div className={`flex ${mine ? "justify-end" : "justify-start"} w-full`}>
                        <div className={`max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                          {active.isGroup && !mine && (
                            <p className="mb-0.5 px-1 text-xs font-semibold text-[var(--color-steel)]">{m.senderName}</p>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2 text-sm ${
                              mine
                                ? "rounded-br-sm bg-[var(--color-primary)] text-white"
                                : "rounded-bl-sm bg-hover text-ink"
                            }`}
                          >
                            {m.body}
                          </div>

                          <div className={`mt-0.5 flex items-center gap-1.5 px-1 ${mine ? "justify-end" : "justify-start"}`}>
                            <span className="text-[10px] text-[var(--color-steel)]">{formatTime(m.createdAt)}</span>
                            <button
                              type="button"
                              onClick={() => setReactingTo((prev) => (prev === m.id ? null : m.id))}
                              aria-label="Add reaction"
                              className="text-[var(--color-steel)] hover:text-[var(--color-primary)]"
                            >
                              <Smile className="h-3 w-3" />
                            </button>
                          </div>

                          {reactingTo === m.id && (
                            <div
                              className={`mt-1 flex w-fit gap-1 rounded-full border border-line-strong bg-surface px-2 py-1 shadow-sm ${
                                mine ? "self-end" : "self-start"
                              }`}
                            >
                              {QUICK_EMOJIS.map((e) => (
                                <button
                                  key={e}
                                  type="button"
                                  onClick={() => handleReact(m.id, e)}
                                  className="text-base transition-transform hover:scale-125"
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          )}

                          {reactions.length > 0 && (
                            <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                              {reactions.map((r) => (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={() => handleReact(m.id, r.emoji)}
                                  className={`rounded-full border px-2 py-0.5 text-xs ${
                                    r.mine
                                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                      : "border-line-strong bg-surface text-[var(--color-steel)]"
                                  }`}
                                >
                                  {r.emoji} {r.count}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {isLast &&
                        mine &&
                        receipts &&
                        (() => {
                          const seenBy = receipts.filter(
                            (r) => r.profileId !== profile.id && r.lastReadAt && new Date(r.lastReadAt) >= new Date(m.createdAt),
                          );
                          if (seenBy.length === 0) return null;
                          const label =
                            seenBy.length <= 3
                              ? `Seen by ${seenBy.map((r) => r.fullName.split(" ")[0]).join(", ")}`
                              : `Seen by ${seenBy.length} people`;
                          return <p className="mt-0.5 px-1 text-[10px] text-[var(--color-steel)]">{label}</p>;
                        })()}
                    </div>
                  );
                })}
              </div>
              {active.isAnnouncement && !canPostAnnouncement ? (
                <p className="border-t border-line px-5 py-3.5 text-center text-xs text-[var(--color-steel)]">
                  Only Admins and Super Admins can post to #announcement.
                </p>
              ) : (
                <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-line px-4 py-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={active.isAnnouncement ? "Post an announcement…" : "Type a message…"}
                    className="flex-1 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label="Send"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-steel)]">
              Select a conversation or start a new one.
            </div>
          )}
        </div>
      </div>

      {showNew && <NewConversationModal onClose={() => setShowNew(false)} onStart={handleStartConversation} />}
    </DashboardShell>
  );
}

function NewConversationModal({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (coworkerIds: string[], title: string | null) => void;
}) {
  const [coworkers, setCoworkers] = useState<Coworker[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getCoworkers().then(setCoworkers);
  }, []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const filteredCoworkers = coworkers?.filter((c) => c.fullName.toLowerCase().includes(search.trim().toLowerCase()));

  async function handleStart() {
    if (selected.length === 0) return;
    setStarting(true);
    await onStart(selected, selected.length > 1 ? title.trim() || null : null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-bold text-ink">New Message</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--color-steel)] hover:bg-hover hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-line px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-steel)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coworkers…"
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {selected.length > 1 && (
          <div className="border-b border-line px-5 py-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Group name (optional)"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filteredCoworkers?.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-hover">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                {initials(c.fullName)}
              </div>
              <span className="text-sm font-semibold text-ink">{c.fullName}</span>
            </label>
          ))}
          {coworkers && coworkers.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-steel)]">No other users found.</p>
          )}
        </div>

        <div className="border-t border-line px-5 py-3.5">
          <button
            type="button"
            onClick={handleStart}
            disabled={selected.length === 0 || starting}
            className="w-full rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            {starting ? "Starting…" : "Start Conversation"}
          </button>
        </div>
      </div>
    </div>
  );
}
