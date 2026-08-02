import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/hrActivityLog";
import { calcWorkedHours, getCompanyTimecardEntries } from "@/lib/hrTimecard";
import { getWarningForms, type WarningForm } from "@/lib/hrWarningsAndCoe";
import { getMyPtoRequests, type PtoRequest } from "@/lib/hrPto";

// ── Currency ─────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

// ── Budgets ──────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  category: string;
  period: string; // 'YYYY-MM'
  amount: number;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

function fromBudgetRow(r: any): Budget {
  return {
    id: r.id,
    category: r.category,
    period: r.period,
    amount: Number(r.amount),
    notes: r.notes,
    createdByName: r.creator?.full_name ?? null,
    createdAt: r.created_at,
  };
}

export async function getBudgets(period?: string): Promise<Budget[]> {
  let query = supabase
    .from("budgets")
    .select("id, category, period, amount, notes, created_at, creator:created_by (full_name)")
    .order("period", { ascending: false });
  if (period) query = query.eq("period", period);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as any[]).map(fromBudgetRow);
}

/** Upserts on (category, period) — re-adding the same category for a period updates its amount instead of erroring. */
export async function addBudget(input: { category: string; period: string; amount: number; notes?: string }): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("budgets").upsert(
    {
      category: input.category.trim(),
      period: input.period,
      amount: input.amount,
      notes: input.notes?.trim() || null,
      created_by: user?.id ?? null,
    },
    { onConflict: "category,period" },
  );
  if (error) throw new Error(error.message);
  await logActivity({ action: "budget_added", targetLabel: `${input.category} (${input.period})` });
}

export async function deleteBudget(budget: Budget): Promise<void> {
  const { error } = await supabase.from("budgets").delete().eq("id", budget.id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "budget_deleted", targetLabel: `${budget.category} (${budget.period})` });
}

// ── Expenses ─────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  receiptPath: string | null;
  createdByName: string | null;
  createdAt: string;
}

function fromExpenseRow(r: any): Expense {
  return {
    id: r.id,
    category: r.category,
    description: r.description,
    amount: Number(r.amount),
    expenseDate: r.expense_date,
    receiptPath: r.receipt_path,
    createdByName: r.creator?.full_name ?? null,
    createdAt: r.created_at,
  };
}

export async function getExpenses(startDate: string, endDate: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, category, description, amount, expense_date, receipt_path, created_at, creator:created_by (full_name)")
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as any[]).map(fromExpenseRow);
}

/** Inserts the expense, then uploads the receipt (if given) and links it to the new row. */
export async function addExpense(
  input: { category: string; description: string; amount: number; expenseDate: string },
  receipt?: File,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: row, error } = await supabase
    .from("expenses")
    .insert({
      category: input.category.trim(),
      description: input.description.trim(),
      amount: input.amount,
      expense_date: input.expenseDate,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (receipt) await uploadExpenseReceipt(row.id, receipt);
  await logActivity({ action: "expense_added", targetLabel: input.description, details: { amount: input.amount } });
}

export async function uploadExpenseReceipt(expenseId: string, file: File): Promise<void> {
  const path = `${expenseId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from("expense-receipts").upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("expenses").update({ receipt_path: path }).eq("id", expenseId);
  if (error) throw new Error(error.message);
  await logActivity({ action: "expense_receipt_uploaded", targetLabel: file.name });
}

export async function getExpenseReceiptUrl(receiptPath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(receiptPath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteExpense(expense: Expense): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
  if (error) throw new Error(error.message);
  await logActivity({ action: "expense_deleted", targetLabel: expense.description });
}

export interface BudgetVsActual {
  category: string;
  budgeted: number;
  actual: number;
}

/** Compares each budget line for a 'YYYY-MM' period against expenses logged in that same month. */
export async function getBudgetVsActual(period: string): Promise<BudgetVsActual[]> {
  const [year, month] = period.split("-").map(Number);
  const start = `${period}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${period}-${String(lastDay).padStart(2, "0")}`;

  const [budgets, expenses] = await Promise.all([getBudgets(period), getExpenses(start, end)]);

  const actualByCategory = new Map<string, number>();
  for (const e of expenses) actualByCategory.set(e.category, (actualByCategory.get(e.category) ?? 0) + e.amount);

  const categories = new Set([...budgets.map((b) => b.category), ...actualByCategory.keys()]);
  return [...categories].map((category) => ({
    category,
    budgeted: budgets.find((b) => b.category === category)?.amount ?? 0,
    actual: actualByCategory.get(category) ?? 0,
  }));
}

// ── Payroll ──────────────────────────────────────────────────────────────

export interface EmployeePayInfo {
  id: string;
  fullName: string;
  hourlyRate: number | null;
}

export async function listEmployeePayInfo(): Promise<EmployeePayInfo[]> {
  const { data, error } = await supabase.rpc("list_employee_pay_info");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; full_name: string; hourly_rate: number | null }>).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    hourlyRate: r.hourly_rate == null ? null : Number(r.hourly_rate),
  }));
}

export async function updateEmployeePayRate(profileId: string, employeeName: string, hourlyRate: number): Promise<void> {
  const { error } = await supabase.rpc("update_employee_pay_rate", { p_profile_id: profileId, p_hourly_rate: hourlyRate });
  if (error) throw new Error(error.message);
  await logActivity({ action: "employee_pay_rate_updated", targetLabel: employeeName, details: { hourlyRate } });
}

export interface PayrollLine {
  profileId: string;
  employeeName: string;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  grossPay: number;
}

/** Monday of the ISO week containing the given 'YYYY-MM-DD' date, as a sortable string key. */
function weekBucketKey(workDate: string): string {
  const d = new Date(`${workDate}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

/**
 * Totals timecard hours per employee for [startDate, endDate] and splits
 * them into regular vs overtime per calendar week (hours over 40/week are
 * 1.5x). Weeks are bucketed using only entries inside the given range, so
 * pick period boundaries that align to full weeks for accurate overtime.
 */
export async function calculatePayroll(startDate: string, endDate: string): Promise<PayrollLine[]> {
  const [entries, payInfo] = await Promise.all([getCompanyTimecardEntries(startDate, endDate), listEmployeePayInfo()]);

  const hoursByEmployeeWeek = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const hours = calcWorkedHours(entry);
    if (hours <= 0) continue;
    const weekMap = hoursByEmployeeWeek.get(entry.profileId) ?? new Map<string, number>();
    const wk = weekBucketKey(entry.workDate);
    weekMap.set(wk, (weekMap.get(wk) ?? 0) + hours);
    hoursByEmployeeWeek.set(entry.profileId, weekMap);
  }

  // Base the list on every employee (not just those with hours in range) so pay rates and
  // zero-hour employees are still visible for review/editing in the same table.
  return payInfo
    .map((info) => {
      const weekMap = hoursByEmployeeWeek.get(info.id);
      let regular = 0;
      let overtime = 0;
      if (weekMap) {
        for (const weekHours of weekMap.values()) {
          regular += Math.min(40, weekHours);
          overtime += Math.max(0, weekHours - 40);
        }
      }
      const hourlyRate = info.hourlyRate ?? 0;
      return {
        profileId: info.id,
        employeeName: info.fullName,
        regularHours: regular,
        overtimeHours: overtime,
        hourlyRate,
        grossPay: regular * hourlyRate + overtime * hourlyRate * 1.5,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export interface PayrollRunSummary {
  id: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  totalGross: number;
}

export async function savePayrollRun(periodStart: string, periodEnd: string, lines: PayrollLine[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: run, error } = await supabase
    .from("payroll_runs")
    .insert({ period_start: periodStart, period_end: periodEnd, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: linesError } = await supabase.from("payroll_run_lines").insert(
    lines.map((l) => ({
      payroll_run_id: run.id,
      profile_id: l.profileId,
      employee_name: l.employeeName,
      regular_hours: l.regularHours,
      overtime_hours: l.overtimeHours,
      hourly_rate: l.hourlyRate,
      gross_pay: l.grossPay,
    })),
  );
  if (linesError) throw new Error(linesError.message);
  await logActivity({ action: "payroll_run_generated", targetLabel: `${periodStart} – ${periodEnd}` });
}

export async function getPayrollRuns(): Promise<PayrollRunSummary[]> {
  const { data, error } = await supabase
    .from("payroll_runs")
    .select("id, period_start, period_end, created_at, payroll_run_lines(gross_pay)")
    .order("period_start", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    id: string;
    period_start: string;
    period_end: string;
    created_at: string;
    payroll_run_lines: { gross_pay: number }[];
  }>).map((r) => ({
    id: r.id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    createdAt: r.created_at,
    totalGross: r.payroll_run_lines.reduce((sum, l) => sum + Number(l.gross_pay), 0),
  }));
}

export async function getPayrollRunLines(runId: string): Promise<PayrollLine[]> {
  const { data, error } = await supabase
    .from("payroll_run_lines")
    .select("profile_id, employee_name, regular_hours, overtime_hours, hourly_rate, gross_pay")
    .eq("payroll_run_id", runId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{
    profile_id: string | null;
    employee_name: string;
    regular_hours: number;
    overtime_hours: number;
    hourly_rate: number;
    gross_pay: number;
  }>).map((r) => ({
    profileId: r.profile_id ?? "",
    employeeName: r.employee_name,
    regularHours: Number(r.regular_hours),
    overtimeHours: Number(r.overtime_hours),
    hourlyRate: Number(r.hourly_rate),
    grossPay: Number(r.gross_pay),
  }));
}

// ── Employee detail (payroll drill-down) ────────────────────────────────

export interface EmployeeTimecardDay {
  workDate: string;
  checkIn: string;
  checkOut: string;
  hours: number;
}

export interface EmployeeDetail {
  timecard: EmployeeTimecardDay[];
  warnings: WarningForm[];
  ptoRequests: PtoRequest[];
}

/** Timecard entries are scoped to [startDate, endDate] (the payroll period); warnings and PTO show full history for context. */
export async function getEmployeeDetail(profileId: string, startDate: string, endDate: string): Promise<EmployeeDetail> {
  const [entries, warnings, ptoRequests] = await Promise.all([
    getCompanyTimecardEntries(startDate, endDate),
    getWarningForms(profileId),
    getMyPtoRequests(profileId),
  ]);
  const timecard = entries
    .filter((e) => e.profileId === profileId)
    .map((e) => ({ workDate: e.workDate, checkIn: e.checkIn, checkOut: e.checkOut, hours: calcWorkedHours(e) }))
    .sort((a, b) => a.workDate.localeCompare(b.workDate));
  return { timecard, warnings, ptoRequests };
}
