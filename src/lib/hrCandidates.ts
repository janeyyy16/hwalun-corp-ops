import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";

export type CandidateStatus = "applied" | "interviewing" | "hired" | "rejected";

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
  createdAt: string;
}

const SELECT = "id, full_name, phone, email, position, department, cv_path, status, notes, created_at";

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
  const { data, error } = await supabase
    .from("hr_candidates")
    .insert({
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      position: input.position?.trim() || null,
      department: input.department?.trim() || null,
      notes: input.notes?.trim() || null,
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
