import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";

export type CandidateStatus = "applied" | "interviewing" | "training" | "on_hold" | "hired" | "rejected";

export interface Candidate {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  cvPath: string | null;
  status: CandidateStatus;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

const SELECT =
  "id, full_name, phone, email, position, department, cv_path, status, notes, created_at, author:created_by (full_name)";

interface CandidateRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  cv_path: string | null;
  status: CandidateStatus;
  notes: string | null;
  created_at: string;
  author: { full_name: string } | null;
}

function fromRow(r: CandidateRow): Candidate {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    position: r.position,
    department: r.department,
    cvPath: r.cv_path,
    status: r.status,
    notes: r.notes,
    createdByName: r.author?.full_name ?? null,
    createdAt: r.created_at,
  };
}

export async function getCandidates(): Promise<Candidate[]> {
  const { data, error } = await supabase.from("hr_candidates").select(SELECT).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CandidateRow[]).map(fromRow);
}

export interface AddCandidateInput {
  fullName: string;
  phone?: string;
  email?: string;
  position?: string;
  department?: string;
  notes?: string;
}

export async function addCandidate(input: AddCandidateInput): Promise<Candidate> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("hr_candidates")
    .insert({
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      position: input.position?.trim() || null,
      department: input.department?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  const candidate = fromRow(data as unknown as CandidateRow);
  await logActivity({ action: "candidate_added", targetLabel: candidate.fullName });
  return candidate;
}

export async function updateCandidateStatus(id: string, fullName: string, status: CandidateStatus): Promise<void> {
  const { error } = await supabase
    .from("hr_candidates")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "candidate_status_changed", targetLabel: fullName, details: { status } });
}

export async function deleteCandidate(id: string, fullName: string): Promise<void> {
  const { error } = await supabase.from("hr_candidates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "candidate_deleted", targetLabel: fullName });
}

/** Uploads a CV to the private bucket and records its path on the candidate row. */
export async function uploadCandidateCv(candidateId: string, fullName: string, file: File): Promise<void> {
  const path = `${candidateId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from("candidate-cvs").upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("hr_candidates").update({ cv_path: path }).eq("id", candidateId);
  if (error) throw new Error(error.message);
  await logActivity({ action: "candidate_cv_uploaded", targetLabel: fullName });
}

/** Bucket is private — generate a short-lived signed URL on demand rather than caching one. */
export async function getCandidateCvUrl(cvPath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("candidate-cvs").createSignedUrl(cvPath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Records a "Forward CV" action — logged for the hiring report, no messaging system to actually deliver it. */
export async function logCvForward(candidateId: string, candidateName: string, recipientId: string, recipientName: string): Promise<void> {
  const { error } = await supabase.from("hr_candidate_cv_forwards").insert({ candidate_id: candidateId, recipient_id: recipientId });
  if (error) throw new Error(error.message);
  await logActivity({ action: "candidate_cv_forwarded", targetLabel: candidateName, details: { forwardedTo: recipientName } });
}

// =====================================================================
// Staff Needed (per Position + Department, manually entered by HR)
// =====================================================================

export interface StaffingTarget {
  id: string;
  position: string;
  department: string;
  staffNeeded: number;
  updatedAt: string;
}

export async function getStaffingTargets(): Promise<StaffingTarget[]> {
  const { data, error } = await supabase
    .from("hr_staffing_targets")
    .select("id, position, department, staff_needed, updated_at")
    .order("position")
    .order("department");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    position: r.position,
    department: r.department,
    staffNeeded: r.staff_needed,
    updatedAt: r.updated_at,
  }));
}

/** Sets the Staff Needed value for a Position+Department (creates the row if it doesn't exist yet). */
export async function setStaffingTarget(position: string, department: string, staffNeeded: number): Promise<void> {
  const { error } = await supabase
    .from("hr_staffing_targets")
    .upsert({ position, department, staff_needed: staffNeeded, updated_at: new Date().toISOString() }, { onConflict: "position,department" });
  if (error) throw new Error(error.message);
  await logActivity({ action: "staffing_target_updated", targetLabel: `${position} — ${department}`, details: { staffNeeded } });
}

// =====================================================================
// Hiring Report — live snapshot grouped by Position -> Department
// =====================================================================

export interface HiringReportRow {
  position: string;
  department: string;
  staffNeeded: number;
  scheduledInterviews: number;
  activeTrainees: number;
  onHold: boolean;
  cvsForwarded: number;
}

const UNSET_LABEL = "(Unassigned)";

/** Live snapshot grouped by Position -> Department, matching the Candidates list against Staff Needed targets and CV-forward counts. */
export async function getHiringReport(): Promise<HiringReportRow[]> {
  const [candidates, targets, { data: forwards }] = await Promise.all([
    getCandidates(),
    getStaffingTargets(),
    supabase.from("hr_candidate_cv_forwards").select("candidate_id"),
  ]);

  const forwardCountByCandidate = new Map<string, number>();
  for (const f of forwards ?? []) {
    forwardCountByCandidate.set(f.candidate_id, (forwardCountByCandidate.get(f.candidate_id) ?? 0) + 1);
  }

  const map = new Map<string, HiringReportRow>();
  const keyOf = (p: string, d: string) => `${p}||${d}`;
  const ensure = (position: string, department: string) => {
    const key = keyOf(position, department);
    if (!map.has(key)) {
      map.set(key, { position, department, staffNeeded: 0, scheduledInterviews: 0, activeTrainees: 0, onHold: false, cvsForwarded: 0 });
    }
    return map.get(key)!;
  };

  for (const t of targets) ensure(t.position || UNSET_LABEL, t.department || UNSET_LABEL).staffNeeded = t.staffNeeded;

  for (const c of candidates) {
    const row = ensure(c.position || UNSET_LABEL, c.department || UNSET_LABEL);
    if (c.status === "interviewing") row.scheduledInterviews += 1;
    if (c.status === "training") row.activeTrainees += 1;
    if (c.status === "on_hold") row.onHold = true;
    row.cvsForwarded += forwardCountByCandidate.get(c.id) ?? 0;
  }

  return Array.from(map.values()).sort((a, b) => a.position.localeCompare(b.position) || a.department.localeCompare(b.department));
}
