import { supabase } from "@/lib/supabase";

export interface ConversationSummary {
  id: string;
  isGroup: boolean;
  isAnnouncement: boolean;
  title: string | null;
  otherParticipants: { id: string; fullName: string }[];
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: boolean;
}

export interface Reaction {
  emoji: string;
  profileId: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  reactions: Reaction[];
}

export interface Coworker {
  id: string;
  fullName: string;
}

export interface ReadReceipt {
  profileId: string;
  fullName: string;
  lastReadAt: string | null;
}

/**
 * profiles' RLS only lets a caller read their own row (or everyone's if
 * hr/super_admin) — too narrow for messaging, where any authenticated user
 * needs to see any other user's display name. list_profile_names() is a
 * SECURITY DEFINER RPC that exposes just id + full_name to everyone.
 */
async function getProfileNames(ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("list_profile_names");
  if (error) throw new Error(error.message);
  const all = new Map(((data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  return new Map(ids.map((id) => [id, all.get(id) ?? "Unknown"]));
}

export async function getCoworkers(): Promise<Coworker[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("list_profile_names");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; full_name: string }[])
    .filter((p) => p.id !== user?.id)
    .map((p) => ({ id: p.id, fullName: p.full_name }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("profile_id", user.id);
  if (membershipError) throw new Error(membershipError.message);
  if (!memberships || memberships.length === 0) return [];

  const conversationIds = memberships.map((m) => m.conversation_id as string);
  const lastReadByConversation = new Map(memberships.map((m) => [m.conversation_id as string, m.last_read_at as string | null]));

  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, is_group, is_announcement, title")
    .in("id", conversationIds);
  if (convError) throw new Error(convError.message);

  const { data: participants, error: partError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, profile_id")
    .in("conversation_id", conversationIds);
  if (partError) throw new Error(partError.message);

  const otherProfileIds = ((participants ?? []) as { conversation_id: string; profile_id: string }[])
    .filter((p) => p.profile_id !== user.id)
    .map((p) => p.profile_id);
  const namesById = await getProfileNames(otherProfileIds);

  const { data: lastMessages, error: msgError } = await supabase
    .from("messages")
    .select("conversation_id, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });
  if (msgError) throw new Error(msgError.message);

  const lastMessageByConversation = new Map<string, { body: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    const key = m.conversation_id as string;
    if (!lastMessageByConversation.has(key)) {
      lastMessageByConversation.set(key, { body: m.body as string, created_at: m.created_at as string });
    }
  }

  return ((conversations ?? []) as { id: string; is_group: boolean; is_announcement: boolean; title: string | null }[])
    .map((c) => {
      const others = ((participants ?? []) as { conversation_id: string; profile_id: string }[])
        .filter((p) => p.conversation_id === c.id && p.profile_id !== user.id)
        .map((p) => ({ id: p.profile_id, fullName: namesById.get(p.profile_id) ?? "Unknown" }));
      const last = lastMessageByConversation.get(c.id);
      const lastReadAt = lastReadByConversation.get(c.id);
      const unread = !!last && (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt));
      return {
        id: c.id,
        isGroup: c.is_group,
        isAnnouncement: c.is_announcement,
        title: c.title,
        otherParticipants: others,
        lastMessage: last?.body ?? null,
        lastMessageAt: last?.created_at ?? null,
        unread,
      };
    })
    .sort((a, b) => {
      if (a.isAnnouncement !== b.isAnnouncement) return a.isAnnouncement ? -1 : 1;
      return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
    });
}

export async function hasUnreadMessages(): Promise<boolean> {
  const conversations = await getConversations();
  return conversations.some((c) => c.unread);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }[];
  const namesById = await getProfileNames([...new Set(rows.map((m) => m.sender_id))]);

  const messageIds = rows.map((m) => m.id);
  const reactionsByMessage = new Map<string, Reaction[]>();
  if (messageIds.length > 0) {
    const { data: reactionRows, error: reactionError } = await supabase
      .from("message_reactions")
      .select("message_id, profile_id, emoji")
      .in("message_id", messageIds);
    if (reactionError) throw new Error(reactionError.message);
    for (const r of (reactionRows ?? []) as { message_id: string; profile_id: string; emoji: string }[]) {
      const list = reactionsByMessage.get(r.message_id) ?? [];
      list.push({ emoji: r.emoji, profileId: r.profile_id });
      reactionsByMessage.set(r.message_id, list);
    }
  }

  return rows.map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    senderName: namesById.get(m.sender_id) ?? "Unknown",
    body: m.body,
    createdAt: m.created_at,
    reactions: reactionsByMessage.get(m.id) ?? [],
  }));
}

/** Toggles the current user's reaction on a message: same emoji removes it, a different one replaces it. */
export async function toggleReaction(messageId: string, emoji: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: existing, error: existingError } = await supabase
    .from("message_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing && existing.emoji === emoji) {
    const { error } = await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("profile_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("message_reactions")
      .upsert({ message_id: messageId, profile_id: user.id, emoji }, { onConflict: "message_id,profile_id" });
    if (error) throw new Error(error.message);
  }
}

/** Who has read up to now in this conversation, and when — used to compute "Seen" under the last message. */
export async function getReadReceipts(conversationId: string): Promise<ReadReceipt[]> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("profile_id, last_read_at")
    .eq("conversation_id", conversationId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { profile_id: string; last_read_at: string | null }[];
  const namesById = await getProfileNames(rows.map((r) => r.profile_id));
  return rows.map((r) => ({
    profileId: r.profile_id,
    fullName: namesById.get(r.profile_id) ?? "Unknown",
    lastReadAt: r.last_read_at,
  }));
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body });
  if (error) throw new Error(error.message);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", user.id);
}

/** Reuses an existing 1:1 thread with this person if one already exists, otherwise starts a new one. */
export async function startDirectConversation(otherProfileId: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: myConversations, error: myError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", user.id);
  if (myError) throw new Error(myError.message);

  const myConversationIds = (myConversations ?? []).map((c) => c.conversation_id as string);
  if (myConversationIds.length > 0) {
    const { data: theirConversations, error: theirError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", otherProfileId)
      .in("conversation_id", myConversationIds);
    if (theirError) throw new Error(theirError.message);

    for (const row of theirConversations ?? []) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, is_group")
        .eq("id", row.conversation_id as string)
        .single();
      if (conv && !conv.is_group) return conv.id as string;
    }
  }

  return startGroupConversation(null, [otherProfileId]);
}

export async function startGroupConversation(title: string | null, otherProfileIds: string[]): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ is_group: otherProfileIds.length > 1, title, created_by: user.id })
    .select("id")
    .single();
  if (convError) throw new Error(convError.message);

  // Insert the creator's own membership first (in its own statement) so the
  // "is_conversation_participant" check used by the next insert's RLS policy
  // can actually see it — a later row's WITH CHECK can't rely on seeing
  // earlier rows from the very same multi-row insert.
  const { error: selfError } = await supabase
    .from("conversation_participants")
    .insert({ conversation_id: conversation.id as string, profile_id: user.id });
  if (selfError) throw new Error(selfError.message);

  if (otherProfileIds.length > 0) {
    const participantRows = otherProfileIds.map((profileId) => ({
      conversation_id: conversation.id as string,
      profile_id: profileId,
    }));
    const { error: partError } = await supabase.from("conversation_participants").insert(participantRows);
    if (partError) throw new Error(partError.message);
  }

  return conversation.id as string;
}

export function subscribeToConversationMessages(conversationId: string, onInsert: (message: Message) => void) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      async (payload) => {
        const row = payload.new as { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
        const namesById = await getProfileNames([row.sender_id]);
        onInsert({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          senderName: namesById.get(row.sender_id) ?? "Unknown",
          body: row.body,
          createdAt: row.created_at,
          reactions: [],
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNewMessages(onChange: () => void) {
  const channel = supabase
    .channel(`messages:all:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** No conversation_id column on message_reactions to filter by, so this just fires on any reaction change. */
export function subscribeToReactions(onChange: () => void) {
  const channel = supabase
    .channel(`reactions:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToConversationParticipants(conversationId: string, onChange: () => void) {
  const channel = supabase
    .channel(`participants:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
