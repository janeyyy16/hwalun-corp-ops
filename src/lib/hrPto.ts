import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";

export type PtoType = "vacation" | "sick" | "personal" | "unpaid";
export type PtoStatus = "pending" | "approved" | "denied" | "cancelled";

export interface PtoRequest {
  id: string;
  profileId: string;
  employeeName: string | null;
  ptoType: PtoType;
  startDate: string;
  endDate: string;
  hoursRequested: number;
  reason: string | null;
  status: PtoStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface PtoRequestRow {
  id: string;
  profile_id: string;
  pto_type: PtoType;
  start_date: string;
  end_date: string;
  hours_requested: number;
  reason: string | null;
  status: PtoStatus;
  reviewed_at: string | null;
  created_at: string;
  employee: { full_name: string } | null;
  reviewer: { full_name: string } | null;
}

const SELECT =
  "id, profile_id, pto_type, start_date, end_date, hours_requested, reason, status, reviewed_at, created_at, employee:profile_id (full_name), reviewer:reviewed_by (full_name)";

function fromRow(r: PtoRequestRow): PtoRequest {
  return {
    id: r.id,
    profileId: r.profile_id,
    employeeName: r.employee?.full_name ?? null,
    ptoType: r.pto_type,
    startDate: r.start_date,
    endDate: r.end_date,
    hoursRequested: Number(r.hours_requested) || 0,
    reason: r.reason,
    status: r.status,
    reviewedByName: r.reviewer?.full_name ?? null,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  };
}

/** Count weekdays (Mon-Fri) in an inclusive date range — used for the default hours estimate. */
export function weekdayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return Math.max(1, count);
}

/** Employees need 1 year of tenure (from profiles.created_at) before they're eligible for PTO. */
export function ptoEligibleDate(createdAt: string | null | undefined): string | null {
  const base = (createdAt || "").slice(0, 10);
  if (!base) return null;
  const d = new Date(base + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function isEligibleForPto(createdAt: string | null | undefined): boolean {
  const eligibleDate = ptoEligibleDate(createdAt);
  if (!eligibleDate) return false;
  return new Date().toISOString().slice(0, 10) >= eligibleDate;
}

/** Annual PTO allowance by tenure year: year 1 = 5 days, +1 day per following year, uncapped. `unpaid` doesn't draw against this. */
export function ptoAllowanceForTenureYear(tenureYear: number): number {
  return tenureYear < 1 ? 0 : 4 + tenureYear;
}

function fullYearsElapsed(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const fromMonthDay = from.getMonth() * 100 + from.getDate();
  const toMonthDay = to.getMonth() * 100 + to.getDate();
  if (toMonthDay < fromMonthDay) years -= 1;
  return years;
}

export interface PtoYearWindow {
  tenureYear: number;
  start: string;
  end: string;
  allowance: number;
}

/** Which PTO tenure-year `onDate` falls in, anchored to the employee's hire anniversary (profiles.created_at). */
export function ptoYearWindow(
  createdAt: string | null | undefined,
  onDate: string = new Date().toISOString().slice(0, 10),
): PtoYearWindow | null {
  const base = (createdAt || "").slice(0, 10);
  if (!base) return null;
  const hire = new Date(base + "T00:00:00");
  const target = new Date(onDate + "T00:00:00");
  if (Number.isNaN(hire.getTime()) || Number.isNaN(target.getTime())) return null;

  const tenureYear = fullYearsElapsed(hire, target);
  if (tenureYear < 1) return null;

  const start = new Date(hire);
  start.setFullYear(hire.getFullYear() + tenureYear);
  const end = new Date(hire);
  end.setFullYear(hire.getFullYear() + tenureYear + 1);

  return {
    tenureYear,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    allowance: ptoAllowanceForTenureYear(tenureYear),
  };
}

/** Days already spoken for (pending or approved) inside a PTO year window. */
export function ptoDaysUsed(
  requests: Pick<PtoRequest, "ptoType" | "status" | "startDate" | "hoursRequested">[],
  window: Pick<PtoYearWindow, "start" | "end">,
): number {
  return requests
    .filter(
      (r) =>
        r.ptoType !== "unpaid" &&
        r.status !== "denied" &&
        r.status !== "cancelled" &&
        r.startDate >= window.start &&
        r.startDate < window.end,
    )
    .reduce((sum, r) => sum + r.hoursRequested / 8, 0);
}

export async function getMyProfileCreatedAt(profileId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("created_at").eq("id", profileId).single();
  if (error) throw new Error(error.message);
  return data?.created_at ?? null;
}

export async function getMyPtoRequests(profileId: string): Promise<PtoRequest[]> {
  const { data, error } = await supabase
    .from("pto_requests")
    .select(SELECT)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PtoRequestRow[]).map(fromRow);
}

export async function getCompanyPtoRequests(): Promise<PtoRequest[]> {
  const { data, error } = await supabase.from("pto_requests").select(SELECT).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PtoRequestRow[]).map(fromRow);
}

export async function createPtoRequest(input: {
  profileId: string;
  employeeName: string;
  ptoType: PtoType;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<void> {
  const hoursRequested = weekdayCount(input.startDate, input.endDate) * 8;
  const { error } = await supabase.from("pto_requests").insert({
    profile_id: input.profileId,
    pto_type: input.ptoType,
    start_date: input.startDate,
    end_date: input.endDate,
    hours_requested: hoursRequested,
    reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
  await logActivity({ action: "pto_requested", targetLabel: input.employeeName, details: { ptoType: input.ptoType } });
}

export async function cancelPtoRequest(id: string, employeeName: string): Promise<void> {
  const { error } = await supabase.from("pto_requests").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "pto_cancelled", targetLabel: employeeName });
}

export async function reviewPtoRequest(
  id: string,
  employeeName: string,
  status: "approved" | "denied",
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("pto_requests")
    .update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: status === "approved" ? "pto_approved" : "pto_denied", targetLabel: employeeName });
}
