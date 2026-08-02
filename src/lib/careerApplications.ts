import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";
import { addCandidate } from "@/lib/hrCandidates";

export type ApplicationStatus = "new" | "reviewed" | "converted" | "rejected";

export interface CareerApplication {
  id: string;
  name: string;
  email: string;
  department: string;
  message: string | null;
  resumePath: string;
  status: ApplicationStatus;
  createdAt: string;
}

const SELECT = "id, name, email, department, message, resume_path, status, created_at";

interface CareerApplicationRow {
  id: string;
  name: string;
  email: string;
  department: string;
  message: string | null;
  resume_path: string;
  status: ApplicationStatus;
  created_at: string;
}

function fromRow(r: CareerApplicationRow): CareerApplication {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    department: r.department,
    message: r.message,
    resumePath: r.resume_path,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function getCareerApplications(): Promise<CareerApplication[]> {
  const { data, error } = await supabase.from("career_applications").select(SELECT).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CareerApplicationRow[]).map(fromRow);
}

/** Resumes are uploaded by the public careers site into a private "resumes" bucket — generate a short-lived signed URL on demand. */
export async function getResumeUrl(resumePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(resumePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function updateApplicationStatus(id: string, name: string, status: ApplicationStatus): Promise<void> {
  const { error } = await supabase.from("career_applications").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "application_status_changed", targetLabel: name, details: { status } });
}

/**
 * Promotes a career application into an HR candidate: copies the resume from
 * the public site's "resumes" bucket into our own "candidate-cvs" bucket
 * (never lets HR's candidate CVs depend on the public site's storage staying
 * around), creates the hr_candidates row, and marks the application converted.
 */
export async function convertToCandidate(application: CareerApplication): Promise<void> {
  const { data: resumeBlob, error: downloadError } = await supabase.storage.from("resumes").download(application.resumePath);
  if (downloadError) throw new Error(downloadError.message);

  const candidate = await addCandidate({
    fullName: application.name,
    email: application.email,
    department: application.department,
    notes: application.message || undefined,
  });

  const fileName = application.resumePath.split("/").pop() || "resume";
  const cvPath = `${candidate.id}/${Date.now()}_${fileName}`;
  const { error: uploadError } = await supabase.storage.from("candidate-cvs").upload(cvPath, resumeBlob, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase.from("hr_candidates").update({ cv_path: cvPath }).eq("id", candidate.id);
  if (updateError) throw new Error(updateError.message);

  const { error: statusError } = await supabase.from("career_applications").update({ status: "converted" }).eq("id", application.id);
  if (statusError) throw new Error(statusError.message);

  await logActivity({ action: "application_converted_to_candidate", targetLabel: application.name });
}
