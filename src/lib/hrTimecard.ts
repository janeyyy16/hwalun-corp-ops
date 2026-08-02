import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";

export interface TimeEntry {
  checkIn: string;
  checkOut: string;
  mealStart: string;
  mealEnd: string;
  notes: string;
}

const EMPTY_ENTRY: TimeEntry = { checkIn: "", checkOut: "", mealStart: "", mealEnd: "", notes: "" };

function hoursBetween(t1: string, t2: string): number {
  if (!t1 || !t2) return 0;
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  return (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
}

export function calcWorkedHours(entry: TimeEntry): number {
  if (!entry.checkIn || !entry.checkOut) return 0;
  let hrs = hoursBetween(entry.checkIn, entry.checkOut);
  if (entry.mealStart && entry.mealEnd) hrs -= hoursBetween(entry.mealStart, entry.mealEnd);
  return Math.max(0, hrs);
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export async function getEntryForDate(profileId: string, workDate: string): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("timecard_entries")
    .select("check_in, check_out, meal_start, meal_end, notes")
    .eq("profile_id", profileId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ...EMPTY_ENTRY };
  return {
    checkIn: data.check_in ?? "",
    checkOut: data.check_out ?? "",
    mealStart: data.meal_start ?? "",
    mealEnd: data.meal_end ?? "",
    notes: data.notes ?? "",
  };
}

export async function saveEntry(profileId: string, workDate: string, entry: TimeEntry): Promise<void> {
  const { error } = await supabase.from("timecard_entries").upsert(
    {
      profile_id: profileId,
      work_date: workDate,
      check_in: entry.checkIn || null,
      check_out: entry.checkOut || null,
      meal_start: entry.mealStart || null,
      meal_end: entry.mealEnd || null,
      notes: entry.notes || null,
    },
    { onConflict: "profile_id,work_date" },
  );
  if (error) throw new Error(error.message);
}

export async function getEntriesInRange(profileId: string, startDate: string, endDate: string): Promise<Record<string, TimeEntry>> {
  const { data, error } = await supabase
    .from("timecard_entries")
    .select("work_date, check_in, check_out, meal_start, meal_end, notes")
    .eq("profile_id", profileId)
    .gte("work_date", startDate)
    .lte("work_date", endDate);
  if (error) throw new Error(error.message);

  const map: Record<string, TimeEntry> = {};
  for (const row of data ?? []) {
    map[row.work_date as string] = {
      checkIn: row.check_in ?? "",
      checkOut: row.check_out ?? "",
      mealStart: row.meal_start ?? "",
      mealEnd: row.meal_end ?? "",
      notes: row.notes ?? "",
    };
  }
  return map;
}

export async function getMonthEntries(profileId: string, year: number, month: number): Promise<Record<string, TimeEntry>> {
  const mm = String(month + 1).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return getEntriesInRange(profileId, start, end);
}

export interface CompanyTimeEntry extends TimeEntry {
  profileId: string;
  employeeName: string | null;
  workDate: string;
}

export async function getCompanyTimecardEntries(startDate: string, endDate: string): Promise<CompanyTimeEntry[]> {
  const { data, error } = await supabase
    .from("timecard_entries")
    .select("profile_id, work_date, check_in, check_out, meal_start, meal_end, notes, employee:profile_id (full_name)")
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .order("work_date", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    profile_id: string;
    work_date: string;
    check_in: string | null;
    check_out: string | null;
    meal_start: string | null;
    meal_end: string | null;
    notes: string | null;
    employee: { full_name: string } | null;
  }>).map((r) => ({
    profileId: r.profile_id,
    employeeName: r.employee?.full_name ?? null,
    workDate: r.work_date,
    checkIn: r.check_in ?? "",
    checkOut: r.check_out ?? "",
    mealStart: r.meal_start ?? "",
    mealEnd: r.meal_end ?? "",
    notes: r.notes ?? "",
  }));
}

// ── Corrections ──────────────────────────────────────────────────────────

export type CorrectionStatus = "pending" | "approved" | "rejected";

export interface TimecardCorrection {
  id: string;
  profileId: string;
  employeeName: string | null;
  workDate: string;
  correctedCheckIn: string;
  correctedCheckOut: string;
  correctedMealStart: string;
  correctedMealEnd: string;
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
}

const CORRECTION_SELECT =
  "id, profile_id, work_date, corrected_check_in, corrected_check_out, corrected_meal_start, corrected_meal_end, reason, status, created_at, employee:profile_id (full_name)";

function fromCorrectionRow(r: any): TimecardCorrection {
  return {
    id: r.id,
    profileId: r.profile_id,
    employeeName: r.employee?.full_name ?? null,
    workDate: r.work_date,
    correctedCheckIn: r.corrected_check_in ?? "",
    correctedCheckOut: r.corrected_check_out ?? "",
    correctedMealStart: r.corrected_meal_start ?? "",
    correctedMealEnd: r.corrected_meal_end ?? "",
    reason: r.reason ?? "",
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function getMyTimecardCorrections(profileId: string): Promise<TimecardCorrection[]> {
  const { data, error } = await supabase
    .from("timecard_corrections")
    .select(CORRECTION_SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromCorrectionRow);
}

export async function getCompanyTimecardCorrections(): Promise<TimecardCorrection[]> {
  const { data, error } = await supabase
    .from("timecard_corrections")
    .select(CORRECTION_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromCorrectionRow);
}

export async function createTimecardCorrection(input: {
  profileId: string;
  employeeName: string;
  workDate: string;
  correctedCheckIn: string;
  correctedCheckOut: string;
  correctedMealStart?: string;
  correctedMealEnd?: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.from("timecard_corrections").insert({
    profile_id: input.profileId,
    work_date: input.workDate,
    corrected_check_in: input.correctedCheckIn || null,
    corrected_check_out: input.correctedCheckOut || null,
    corrected_meal_start: input.correctedMealStart || null,
    corrected_meal_end: input.correctedMealEnd || null,
    reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
  await logActivity({ action: "timecard_correction_requested", targetLabel: input.employeeName, details: { workDate: input.workDate } });
}

/** Approve a correction: marks it approved and applies the corrected times to the real timecard entry. */
export async function approveTimecardCorrection(correction: TimecardCorrection): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("timecard_corrections")
    .update({ status: "approved", reviewed_by: user?.id ?? null })
    .eq("id", correction.id);
  if (error) throw new Error(error.message);

  const existing = await getEntryForDate(correction.profileId, correction.workDate);
  await saveEntry(correction.profileId, correction.workDate, {
    checkIn: correction.correctedCheckIn,
    checkOut: correction.correctedCheckOut,
    mealStart: correction.correctedMealStart,
    mealEnd: correction.correctedMealEnd,
    notes: existing.notes,
  });
  await logActivity({ action: "timecard_correction_approved", targetLabel: correction.employeeName ?? "Unknown", details: { workDate: correction.workDate } });
}

export async function rejectTimecardCorrection(correction: TimecardCorrection): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("timecard_corrections")
    .update({ status: "rejected", reviewed_by: user?.id ?? null })
    .eq("id", correction.id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "timecard_correction_rejected", targetLabel: correction.employeeName ?? "Unknown", details: { workDate: correction.workDate } });
}
