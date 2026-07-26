import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";

export interface WarningForm {
  id: string;
  profileId: string;
  reason: string;
  description: string;
  issuedAt: string;
  issuedByName: string | null;
  createdAt: string;
}

export interface CoeDocument {
  id: string;
  profileId: string;
  jobTitle: string;
  startDate: string;
  purpose: string | null;
  issuedByName: string | null;
  createdAt: string;
}

interface WarningFormRow {
  id: string;
  profile_id: string;
  reason: string;
  description: string;
  issued_at: string;
  created_at: string;
  issuer: { full_name: string } | null;
}

interface CoeDocumentRow {
  id: string;
  profile_id: string;
  job_title: string;
  start_date: string;
  purpose: string | null;
  created_at: string;
  issuer: { full_name: string } | null;
}

export async function getWarningForms(profileId: string): Promise<WarningForm[]> {
  const { data, error } = await supabase
    .from("hr_warning_forms")
    .select("id, profile_id, reason, description, issued_at, created_at, issuer:issued_by (full_name)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as WarningFormRow[]).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    reason: r.reason,
    description: r.description,
    issuedAt: r.issued_at,
    issuedByName: r.issuer?.full_name ?? null,
    createdAt: r.created_at,
  }));
}

export async function addWarningForm(
  profileId: string,
  employeeName: string,
  reason: string,
  description: string,
  issuedAt: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("hr_warning_forms").insert({
    profile_id: profileId,
    reason: reason.trim(),
    description: description.trim(),
    issued_at: issuedAt,
    issued_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  await logActivity({ action: "warning_form_issued", targetLabel: employeeName, details: { reason } });
}

export async function getCoeDocuments(profileId: string): Promise<CoeDocument[]> {
  const { data, error } = await supabase
    .from("hr_coe_documents")
    .select("id, profile_id, job_title, start_date, purpose, created_at, issuer:issued_by (full_name)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CoeDocumentRow[]).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    jobTitle: r.job_title,
    startDate: r.start_date,
    purpose: r.purpose,
    issuedByName: r.issuer?.full_name ?? null,
    createdAt: r.created_at,
  }));
}

export async function addCoeDocument(
  profileId: string,
  employeeName: string,
  jobTitle: string,
  startDate: string,
  purpose: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("hr_coe_documents").insert({
    profile_id: profileId,
    job_title: jobTitle.trim(),
    start_date: startDate,
    purpose: purpose.trim() || null,
    issued_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  await logActivity({ action: "coe_generated", targetLabel: employeeName, details: { jobTitle } });
}
