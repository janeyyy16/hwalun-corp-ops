import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";
import type { RoleKey } from "@/lib/auth";

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  meetingDate: string;
  startTime: string;
  endTime: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface MeetingParticipant {
  profileId: string;
  fullName: string;
  readAt: string | null;
}

export interface RoleOption {
  key: RoleKey;
  label: string;
}

interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_date: string;
  start_time: string;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
}

function fromRow(r: MeetingRow, namesById: Map<string, string>): Meeting {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    meetingDate: r.meeting_date,
    startTime: r.start_time,
    endTime: r.end_time,
    createdBy: r.created_by,
    createdByName: r.created_by ? (namesById.get(r.created_by) ?? "Unknown") : null,
    createdAt: r.created_at,
  };
}

async function toMeetings(rows: MeetingRow[]): Promise<Meeting[]> {
  if (rows.length === 0) return [];
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => !!id))];
  const namesById = await getProfileNames(creatorIds);
  return rows.map((r) => fromRow(r, namesById));
}

const MEETING_SELECT = "id, title, description, location, meeting_date, start_time, end_time, created_by, created_at";

async function getProfileNames(ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("list_profile_names");
  if (error) throw new Error(error.message);
  const all = new Map(((data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  return new Map(ids.map((id) => [id, all.get(id) ?? "Unknown"]));
}

export async function getRoles(): Promise<RoleOption[]> {
  const { data, error } = await supabase.from("roles").select("key, label");
  if (error) throw new Error(error.message);
  return (data ?? []) as RoleOption[];
}

/** Meetings in [startDate, endDate] the caller is invited to (or, for admin/super_admin, every meeting). */
export async function getMeetingsInRange(startDate: string, endDate: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .gte("meeting_date", startDate)
    .lte("meeting_date", endDate)
    .order("meeting_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return toMeetings((data ?? []) as MeetingRow[]);
}

export async function getMeetingParticipants(meetingId: string): Promise<MeetingParticipant[]> {
  const { data, error } = await supabase.from("meeting_participants").select("profile_id, read_at").eq("meeting_id", meetingId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { profile_id: string; read_at: string | null }[];
  const namesById = await getProfileNames(rows.map((r) => r.profile_id));
  return rows
    .map((r) => ({ profileId: r.profile_id, fullName: namesById.get(r.profile_id) ?? "Unknown", readAt: r.read_at }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function markMeetingRead(meetingId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("meeting_participants")
    .update({ read_at: new Date().toISOString() })
    .eq("meeting_id", meetingId)
    .eq("profile_id", user.id)
    .is("read_at", null);
}

/** Unread invites (soonest meeting first) — backs the Notifications bell. */
export async function getUnreadMeetingInvites(): Promise<Meeting[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: unreadRows, error: unreadError } = await supabase
    .from("meeting_participants")
    .select("meeting_id")
    .eq("profile_id", user.id)
    .is("read_at", null);
  if (unreadError) throw new Error(unreadError.message);

  const meetingIds = (unreadRows ?? []).map((r) => r.meeting_id as string);
  if (meetingIds.length === 0) return [];

  const { data, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .in("id", meetingIds)
    .order("meeting_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return toMeetings((data ?? []) as MeetingRow[]);
}

export async function hasUnreadMeetingInvites(): Promise<boolean> {
  const invites = await getUnreadMeetingInvites();
  return invites.length > 0;
}

export interface ScheduleMeetingInput {
  title: string;
  description: string;
  location: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  participantIds: string[];
}

export async function scheduleMeeting(input: ScheduleMeetingInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      title: input.title.trim(),
      description: input.description.trim() || null,
      location: input.location.trim() || null,
      meeting_date: input.meetingDate,
      start_time: input.startTime,
      end_time: input.endTime || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (meetingError) throw new Error(meetingError.message);

  const participantIds = [...new Set([user.id, ...input.participantIds])];
  const { error: partError } = await supabase
    .from("meeting_participants")
    .insert(participantIds.map((profileId) => ({ meeting_id: meeting.id as string, profile_id: profileId })));
  if (partError) throw new Error(partError.message);

  await logActivity({ action: "meeting_scheduled", targetLabel: input.title, details: { date: input.meetingDate } });
}

export async function cancelMeeting(meeting: Meeting): Promise<void> {
  const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "meeting_cancelled", targetLabel: meeting.title });
}

export function subscribeToMeetingChanges(onChange: () => void) {
  const channel = supabase
    .channel(`meetings:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "meeting_participants" }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
