import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";

export interface OnboardingDocument {
  id: string;
  profileId: string;
  category: string;
  fileName: string;
  storagePath: string;
  uploadedByName: string | null;
  createdAt: string;
}

interface OnboardingDocumentRow {
  id: string;
  profile_id: string;
  category: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  uploader: { full_name: string } | null;
}

function fromRow(r: OnboardingDocumentRow): OnboardingDocument {
  return {
    id: r.id,
    profileId: r.profile_id,
    category: r.category,
    fileName: r.file_name,
    storagePath: r.storage_path,
    uploadedByName: r.uploader?.full_name ?? null,
    createdAt: r.created_at,
  };
}

export async function getOnboardingDocuments(profileId: string): Promise<OnboardingDocument[]> {
  const { data, error } = await supabase
    .from("hr_onboarding_documents")
    .select("id, profile_id, category, file_name, storage_path, created_at, uploader:uploaded_by (full_name)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as OnboardingDocumentRow[]).map(fromRow);
}

export async function addOnboardingDocument(
  profileId: string,
  employeeName: string,
  category: string,
  file: File,
): Promise<void> {
  const path = `${profileId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from("onboarding-documents").upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("hr_onboarding_documents").insert({
    profile_id: profileId,
    category: category.trim(),
    file_name: file.name,
    storage_path: path,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  await logActivity({ action: "onboarding_document_added", targetLabel: employeeName, details: { category } });
}

export async function getOnboardingDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("onboarding-documents").createSignedUrl(storagePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteOnboardingDocument(id: string, employeeName: string, category: string): Promise<void> {
  const { error } = await supabase.from("hr_onboarding_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "onboarding_document_deleted", targetLabel: employeeName, details: { category } });
}
