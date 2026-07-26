import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";

export type SignableDocumentType = "warning_form" | "w4" | "w8ben" | "w9";
export type SignableDocumentStatus = "pending_signature" | "signed" | "confirmed" | "cancelled";

export interface SignableDocument {
  id: string;
  documentType: SignableDocumentType;
  formData: Record<string, unknown>;
  recipientId: string;
  recipientName: string | null;
  status: SignableDocumentStatus;
  pdfPath: string | null;
  signatureName: string | null;
  signedAt: string | null;
  confirmedAt: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface SignableDocumentRow {
  id: string;
  document_type: SignableDocumentType;
  form_data: Record<string, unknown>;
  recipient_id: string;
  status: SignableDocumentStatus;
  pdf_path: string | null;
  signature_name: string | null;
  signed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  recipient: { full_name: string } | null;
  creator: { full_name: string } | null;
}

const SELECT =
  "id, document_type, form_data, recipient_id, status, pdf_path, signature_name, signed_at, confirmed_at, created_at, recipient:recipient_id (full_name), creator:created_by (full_name)";

function fromRow(r: SignableDocumentRow): SignableDocument {
  return {
    id: r.id,
    documentType: r.document_type,
    formData: r.form_data,
    recipientId: r.recipient_id,
    recipientName: r.recipient?.full_name ?? null,
    status: r.status,
    pdfPath: r.pdf_path,
    signatureName: r.signature_name,
    signedAt: r.signed_at,
    confirmedAt: r.confirmed_at,
    createdByName: r.creator?.full_name ?? null,
    createdAt: r.created_at,
  };
}

export async function getMySignableDocuments(recipientId: string): Promise<SignableDocument[]> {
  const { data, error } = await supabase
    .from("hr_signable_documents")
    .select(SELECT)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SignableDocumentRow[]).map(fromRow);
}

export async function getSignableDocuments(documentType?: SignableDocumentType): Promise<SignableDocument[]> {
  let query = supabase.from("hr_signable_documents").select(SELECT).order("created_at", { ascending: false });
  if (documentType) query = query.eq("document_type", documentType);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SignableDocumentRow[]).map(fromRow);
}

export async function createSignableDocument(input: {
  documentType: SignableDocumentType;
  formData: Record<string, unknown>;
  recipientId: string;
  recipientName: string;
}): Promise<SignableDocument> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("hr_signable_documents")
    .insert({
      document_type: input.documentType,
      form_data: input.formData,
      recipient_id: input.recipientId,
      created_by: user?.id ?? null,
    })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  const doc = fromRow(data as unknown as SignableDocumentRow);
  await logActivity({
    action: doc.documentType === "warning_form" ? "warning_form_issued" : "tax_form_requested",
    targetLabel: input.recipientName,
    details: { documentType: doc.documentType },
  });
  return doc;
}

/** Employee signs: stores their typed name + the filled PDF, marks the document "signed" (awaiting HR confirm). */
export async function signDocument(
  id: string,
  recipientName: string,
  signatureName: string,
  pdfPath?: string,
  formData?: Record<string, unknown>,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "signed",
    signature_name: signatureName,
    signed_at: new Date().toISOString(),
  };
  if (pdfPath) update.pdf_path = pdfPath;
  if (formData) update.form_data = formData;
  const { error } = await supabase.from("hr_signable_documents").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "signable_document_signed", targetLabel: recipientName });
}

/** Swaps in a re-generated PDF (e.g. HR completing the W-4's Employers Only box) without changing status. */
export async function updateSignableDocumentPdf(id: string, pdfPath: string, formData?: Record<string, unknown>): Promise<void> {
  const update: Record<string, unknown> = { pdf_path: pdfPath };
  if (formData) update.form_data = formData;
  const { error } = await supabase.from("hr_signable_documents").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function confirmSignableDocument(id: string, recipientName: string): Promise<void> {
  const { error } = await supabase
    .from("hr_signable_documents")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "signable_document_confirmed", targetLabel: recipientName });
}

export async function cancelSignableDocument(id: string, recipientName: string): Promise<void> {
  const { error } = await supabase.from("hr_signable_documents").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "signable_document_cancelled", targetLabel: recipientName });
}

export async function uploadSignedPdf(documentId: string, bytes: Uint8Array, fileName: string): Promise<string> {
  const path = `${documentId}/${fileName}`;
  const { error } = await supabase.storage.from("hr-signed-documents").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function getSignedPdfUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("hr-signed-documents").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
