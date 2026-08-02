import { supabase } from "@/lib/supabase";

export interface HrActivityLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetLabel: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface LogActivityInput {
  action: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
}

/** Human-readable label for each action code — new codes just show as-is (title-cased) if not listed here. */
const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  candidate_added: "Added candidate",
  candidate_status_changed: "Changed candidate status",
  candidate_deleted: "Deleted candidate",
  candidate_cv_uploaded: "Uploaded candidate CV",
  onboarding_document_added: "Filed onboarding document",
  onboarding_document_deleted: "Removed onboarding document",
  warning_form_issued: "Issued warning form",
  coe_generated: "Generated Certificate of Employment",
  pto_requested: "Requested PTO",
  pto_cancelled: "Cancelled PTO request",
  pto_approved: "Approved PTO request",
  pto_denied: "Denied PTO request",
  timecard_correction_requested: "Requested timecard correction",
  timecard_correction_approved: "Approved timecard correction",
  timecard_correction_rejected: "Rejected timecard correction",
  application_status_changed: "Updated application status",
  application_converted_to_candidate: "Converted application to candidate",
  employee_added: "Added user",
  employee_profile_updated: "Updated employee profile",
  budget_added: "Added budget",
  budget_deleted: "Deleted budget",
  expense_added: "Logged expense",
  expense_receipt_uploaded: "Uploaded expense receipt",
  expense_deleted: "Deleted expense",
  payroll_run_generated: "Generated payroll run",
  employee_pay_rate_updated: "Updated employee pay rate",
  meeting_scheduled: "Scheduled meeting",
  meeting_cancelled: "Cancelled meeting",
};

export function activityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Fire-and-forget audit log write — logging an action should never be able
 * to break the feature it's attached to, so failures are swallowed (and
 * reported to the console) rather than thrown.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("hr_activity_log").insert({
      actor_id: user?.id ?? null,
      action: input.action,
      target_label: input.targetLabel ?? null,
      details: input.details ?? {},
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Failed to write HR activity log entry:", err);
  }
}

export async function getActivityLog(): Promise<HrActivityLogEntry[]> {
  const { data, error } = await supabase
    .from("hr_activity_log")
    .select("id, actor_id, action, target_label, details, created_at, actor:actor_id (full_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    target_label: string | null;
    details: Record<string, unknown>;
    created_at: string;
    actor: { full_name: string } | null;
  }>).map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorName: r.actor?.full_name ?? null,
    action: r.action,
    targetLabel: r.target_label,
    details: r.details,
    createdAt: r.created_at,
  }));
}
