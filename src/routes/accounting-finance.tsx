import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, Paperclip, Plus, Printer, Trash2, Upload, X } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import {
  addBudget,
  addExpense,
  calculatePayroll,
  deleteBudget,
  deleteExpense,
  formatCurrency,
  getBudgetVsActual,
  getBudgets,
  getEmployeeDetail,
  getExpenseReceiptUrl,
  getExpenses,
  getPayrollRunLines,
  getPayrollRuns,
  savePayrollRun,
  updateEmployeePayRate,
  uploadExpenseReceipt,
  type Budget,
  type BudgetVsActual,
  type EmployeeDetail,
  type Expense,
  type PayrollLine,
  type PayrollRunSummary,
} from "@/lib/accountingFinance";

export const Route = createFileRoute("/accounting-finance")({
  component: AccountingFinance,
});

type Tab = "budgets" | "expenses" | "payroll" | "reports";

const TABS: { key: Tab; label: string }[] = [
  { key: "budgets", label: "Budgets" },
  { key: "expenses", label: "Expenses" },
  { key: "payroll", label: "Payroll" },
  { key: "reports", label: "Reports" },
];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(period: string): { start: string; end: string } {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${period}-01`, end: `${period}-${String(lastDay).padStart(2, "0")}` };
}

function AccountingFinance() {
  const { canManageFinance } = useAuth();
  const [tab, setTab] = useState<Tab>("budgets");

  if (!canManageFinance) {
    return (
      <DashboardShell title="Accounting and Finance">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <p className="text-sm text-[var(--color-steel)]">You don't have access to this page.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Accounting and Finance" subtitle="Track budgets, expenses, payroll, and financial reports.">
      <div className="mb-6 flex flex-wrap gap-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-[var(--color-primary)] text-white" : "bg-surface text-[var(--color-steel)] hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "budgets" && <BudgetsTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "payroll" && <PayrollTab />}
      {tab === "reports" && <ReportsTab />}
    </DashboardShell>
  );
}

// ── Budgets ──────────────────────────────────────────────────────────────

function BudgetsTab() {
  const [period, setPeriod] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setBudgets(await getBudgets(period));
  }

  useEffect(() => {
    reload();
  }, [period]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    setError(null);
    try {
      await addBudget({
        category: form.get("category") as string,
        period,
        amount: Number(form.get("amount")),
        notes: (form.get("notes") as string) || undefined,
      });
      formEl.reset();
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add budget.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(b: Budget) {
    await deleteBudget(b);
    await reload();
  }

  const total = budgets?.reduce((sum, b) => sum + b.amount, 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Period</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Budget"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Category</label>
              <input
                name="category"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Amount</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Notes</label>
              <input
                name="notes"
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            {error && <p className="text-sm font-semibold text-red-600 sm:col-span-3">{error}</p>}
            <p className="text-xs text-[var(--color-steel)] sm:col-span-3">
              Adding a budget for a category that already has one this period updates its amount.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 sm:col-span-3 sm:w-fit"
            >
              {submitting ? "Saving…" : "Save Budget"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Notes</th>
              <th className="px-6 py-3">Added By</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {budgets?.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 font-semibold text-ink">{b.category}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{formatCurrency(b.amount)}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{b.notes ?? "—"}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{b.createdByName ?? "—"}</td>
                <td className="px-6 py-3.5">
                  <button type="button" onClick={() => handleDelete(b)} className="text-[var(--color-steel)] hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {budgets && budgets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No budgets set for this period.
                </td>
              </tr>
            )}
            {budgets && budgets.length > 0 && (
              <tr className="bg-subtle font-bold text-ink">
                <td className="px-6 py-3.5">Total</td>
                <td className="px-6 py-3.5">{formatCurrency(total)}</td>
                <td className="px-6 py-3.5" colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Expenses ─────────────────────────────────────────────────────────────

function ExpensesTab() {
  const defaultRange = monthRange(currentMonth());
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setExpenses(await getExpenses(startDate, endDate));
  }

  useEffect(() => {
    reload();
  }, [startDate, endDate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    setError(null);
    const receiptFile = form.get("receipt") as File;
    try {
      await addExpense(
        {
          category: form.get("category") as string,
          description: form.get("description") as string,
          amount: Number(form.get("amount")),
          expenseDate: form.get("expense_date") as string,
        },
        receiptFile && receiptFile.size > 0 ? receiptFile : undefined,
      );
      formEl.reset();
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log expense.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(x: Expense) {
    await deleteExpense(x);
    await reload();
  }

  async function handleAttachReceipt(expense: Expense, file: File) {
    await uploadExpenseReceipt(expense.id, file);
    await reload();
  }

  async function handleViewReceipt(expense: Expense) {
    if (!expense.receiptPath) return;
    const url = await getExpenseReceiptUrl(expense.receiptPath);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleExport() {
    if (!expenses) return;
    downloadCsv(
      `expenses_${startDate}_to_${endDate}.csv`,
      ["Date", "Category", "Description", "Amount"],
      expenses.map((x) => [x.expenseDate, x.category, x.description, x.amount.toFixed(2)]),
    );
  }

  const total = expenses?.reduce((sum, x) => sum + x.amount, 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-bold text-[var(--color-steel)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Log Expense"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Category</label>
              <input
                name="category"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Amount</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Description</label>
              <input
                name="description"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Date</label>
              <input
                name="expense_date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Receipt / Invoice (optional)</label>
              <input
                name="receipt"
                type="file"
                accept="image/*,.pdf"
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-[var(--color-primary)]/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 sm:col-span-2 sm:w-fit"
            >
              {submitting ? "Saving…" : "Save Expense"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Receipt</th>
              <th className="px-6 py-3">Added By</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {expenses?.map((x) => (
              <tr key={x.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{new Date(x.expenseDate + "T00:00:00").toLocaleDateString()}</td>
                <td className="px-6 py-3.5 font-semibold text-ink">{x.category}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{x.description}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{formatCurrency(x.amount)}</td>
                <td className="px-6 py-3.5">
                  <ReceiptCell expense={x} onView={handleViewReceipt} onAttach={handleAttachReceipt} />
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{x.createdByName ?? "—"}</td>
                <td className="px-6 py-3.5">
                  <button type="button" onClick={() => handleDelete(x)} className="text-[var(--color-steel)] hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {expenses && expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No expenses in this range.
                </td>
              </tr>
            )}
            {expenses && expenses.length > 0 && (
              <tr className="bg-subtle font-bold text-ink">
                <td className="px-6 py-3.5" colSpan={3}>
                  Total
                </td>
                <td className="px-6 py-3.5">{formatCurrency(total)}</td>
                <td className="px-6 py-3.5" colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReceiptCell({
  expense,
  onView,
  onAttach,
}: {
  expense: Expense;
  onView: (expense: Expense) => void;
  onAttach: (expense: Expense, file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const inputId = `receipt-upload-${expense.id}`;

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onAttach(expense, file);
    } finally {
      setUploading(false);
    }
  }

  if (expense.receiptPath) {
    return (
      <button
        type="button"
        onClick={() => onView(expense)}
        title="View receipt"
        className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] hover:underline"
      >
        <Paperclip className="h-3.5 w-3.5" />
        View
      </button>
    );
  }

  return (
    <label
      htmlFor={inputId}
      className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-[var(--color-steel)] hover:text-[var(--color-primary)]"
    >
      <Upload className="h-3.5 w-3.5" />
      {uploading ? "Uploading…" : "Attach"}
      <input id={inputId} type="file" accept="image/*,.pdf" className="hidden" disabled={uploading} onChange={handleChange} />
    </label>
  );
}

// ── Payroll ──────────────────────────────────────────────────────────────

function PayrollTab() {
  const defaultRange = monthRange(currentMonth());
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [lines, setLines] = useState<PayrollLine[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<PayrollRunSummary[] | null>(null);
  const [viewingRun, setViewingRun] = useState<{ summary: PayrollRunSummary; lines: PayrollLine[] } | null>(null);
  const [detailLine, setDetailLine] = useState<PayrollLine | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      setLines(await calculatePayroll(startDate, endDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payroll.");
    }
  }

  async function reloadRuns() {
    setRuns(await getPayrollRuns());
  }

  useEffect(() => {
    reload();
  }, [startDate, endDate]);

  useEffect(() => {
    reloadRuns();
  }, []);

  async function handleRateSave(profileId: string, employeeName: string, rateValue: string) {
    const rate = Number(rateValue);
    if (Number.isNaN(rate) || rate < 0) return;
    await updateEmployeePayRate(profileId, employeeName, rate);
    await reload();
  }

  async function handleSaveRun() {
    if (!lines) return;
    setSaving(true);
    try {
      await savePayrollRun(startDate, endDate, lines);
      await reloadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payroll run.");
    } finally {
      setSaving(false);
    }
  }

  async function handleViewRun(run: PayrollRunSummary) {
    const runLines = await getPayrollRunLines(run.id);
    setViewingRun({ summary: run, lines: runLines });
  }

  function handleExport() {
    if (!lines) return;
    downloadCsv(
      `payroll_${startDate}_to_${endDate}.csv`,
      ["Employee", "Hourly Rate", "Regular Hours", "Overtime Hours", "Estimated Salary"],
      lines.map((l) => [l.employeeName, l.hourlyRate.toFixed(2), l.regularHours.toFixed(2), l.overtimeHours.toFixed(2), l.grossPay.toFixed(2)]),
    );
  }

  const total = lines?.reduce((sum, l) => sum + l.grossPay, 0) ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Period Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Period End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-bold text-[var(--color-steel)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleSaveRun}
            disabled={saving || !lines || lines.length === 0}
            className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Payroll Run"}
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--color-steel)]">
        Hours are pulled from timecard entries in this range; hours beyond 40/week are paid at 1.5x. Edit an employee's hourly rate
        directly below — it's per-employee, so it only ever affects that one person.
      </p>
      {error && <p className="mb-4 text-sm font-semibold text-red-600">{error}</p>}

      <div className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Employee</th>
              <th className="px-6 py-3">Hourly Rate</th>
              <th className="px-6 py-3">Regular Hrs</th>
              <th className="px-6 py-3">OT Hrs</th>
              <th className="px-6 py-3">Estimated Salary</th>
            </tr>
          </thead>
          <tbody>
            {lines?.map((l) => (
              <PayrollRow key={l.profileId} line={l} onRateSave={handleRateSave} onOpenDetail={setDetailLine} />
            ))}
            {lines && lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No employees found.
                </td>
              </tr>
            )}
            {lines && lines.length > 0 && (
              <tr className="bg-subtle font-bold text-ink">
                <td className="px-6 py-3.5" colSpan={4}>
                  Total
                </td>
                <td className="px-6 py-3.5">{formatCurrency(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-4 text-lg font-bold text-ink">Past Payroll Runs</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Period</th>
              <th className="px-6 py-3">Generated</th>
              <th className="px-6 py-3">Total Gross</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {runs?.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 font-semibold text-ink">
                  {new Date(r.periodStart + "T00:00:00").toLocaleDateString()} –{" "}
                  {new Date(r.periodEnd + "T00:00:00").toLocaleDateString()}
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{formatCurrency(r.totalGross)}</td>
                <td className="px-6 py-3.5">
                  <button type="button" onClick={() => handleViewRun(r)} className="text-sm font-bold text-[var(--color-primary)] hover:underline">
                    View
                  </button>
                </td>
              </tr>
            ))}
            {runs && runs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No payroll runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewingRun && <PayrollRunModal run={viewingRun} onClose={() => setViewingRun(null)} />}
      {detailLine && (
        <EmployeeDetailModal line={detailLine} startDate={startDate} endDate={endDate} onClose={() => setDetailLine(null)} />
      )}
    </div>
  );
}

function PayrollRow({
  line,
  onRateSave,
  onOpenDetail,
}: {
  line: PayrollLine;
  onRateSave: (profileId: string, employeeName: string, value: string) => Promise<void>;
  onOpenDetail: (line: PayrollLine) => void;
}) {
  const [value, setValue] = useState(line.hourlyRate.toString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(line.hourlyRate.toString());
  }, [line.hourlyRate]);

  async function handleSave() {
    setSaving(true);
    try {
      await onRateSave(line.profileId, line.employeeName, value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-6 py-3.5">
        <button
          type="button"
          onClick={() => onOpenDetail(line)}
          className="font-semibold text-[var(--color-primary)] hover:underline"
        >
          {line.employeeName}
        </button>
      </td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-28 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || value === line.hourlyRate.toString()}
            className="rounded-full border border-line-strong px-3 py-1 text-xs font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-60"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      </td>
      <td className="px-6 py-3.5 text-[var(--color-steel)]">{line.regularHours.toFixed(2)}</td>
      <td className="px-6 py-3.5 text-[var(--color-steel)]">{line.overtimeHours.toFixed(2)}</td>
      <td className="px-6 py-3.5 font-semibold text-ink">{formatCurrency(line.grossPay)}</td>
    </tr>
  );
}

function EmployeeDetailModal({
  line,
  startDate,
  endDate,
  onClose,
}: {
  line: PayrollLine;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);

  useEffect(() => {
    getEmployeeDetail(line.profileId, startDate, endDate).then(setDetail);
  }, [line.profileId, startDate, endDate]);

  const totalTimecardHours = detail?.timecard.reduce((sum, d) => sum + d.hours, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h3 className="font-bold text-ink">{line.employeeName}</h3>
            <p className="text-xs text-[var(--color-steel)]">
              {new Date(startDate + "T00:00:00").toLocaleDateString()} – {new Date(endDate + "T00:00:00").toLocaleDateString()}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--color-steel)] hover:bg-hover hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Hourly Rate" value={formatCurrency(line.hourlyRate)} />
            <SummaryStat label="Hours Worked" value={totalTimecardHours.toFixed(2)} />
            <SummaryStat label="OT Hours" value={line.overtimeHours.toFixed(2)} />
            <SummaryStat label="Est. Salary" value={formatCurrency(line.grossPay)} highlight />
          </div>

          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-steel)]">Timecard</h4>
          <div className="mb-6 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Check In</th>
                  <th className="px-4 py-2">Check Out</th>
                  <th className="px-4 py-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {detail?.timecard.map((d) => (
                  <tr key={d.workDate} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-[var(--color-steel)]">{new Date(d.workDate + "T00:00:00").toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-[var(--color-steel)]">{d.checkIn || "—"}</td>
                    <td className="px-4 py-2 text-[var(--color-steel)]">{d.checkOut || "—"}</td>
                    <td className="px-4 py-2 text-[var(--color-steel)]">{d.hours.toFixed(2)}</td>
                  </tr>
                ))}
                {detail && detail.timecard.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-steel)]">
                      No timecard entries in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-steel)]">Warnings</h4>
          <div className="mb-6 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <tbody>
                {detail?.warnings.map((w) => (
                  <tr key={w.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-ink">{w.reason}</p>
                      <p className="text-xs text-[var(--color-steel)]">{new Date(w.issuedAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-steel)]">{w.issuedByName ?? "—"}</td>
                  </tr>
                ))}
                {detail && detail.warnings.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-[var(--color-steel)]">
                      No warnings on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-steel)]">PTO</h4>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <tbody>
                {detail?.ptoRequests.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold capitalize text-ink">{p.ptoType}</p>
                      <p className="text-xs text-[var(--color-steel)]">
                        {new Date(p.startDate + "T00:00:00").toLocaleDateString()} –{" "}
                        {new Date(p.endDate + "T00:00:00").toLocaleDateString()} ({(p.hoursRequested / 8).toFixed(1)}d)
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                        {p.status[0].toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {detail && detail.ptoRequests.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-[var(--color-steel)]">
                      No PTO requests on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-subtle p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">{label}</p>
      <p className={`mt-1 text-lg font-bold ${highlight ? "text-[var(--color-primary)]" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function PayrollRunModal({
  run,
  onClose,
}: {
  run: { summary: PayrollRunSummary; lines: PayrollLine[] };
  onClose: () => void;
}) {
  function handleExport() {
    downloadCsv(
      `payroll_${run.summary.periodStart}_to_${run.summary.periodEnd}.csv`,
      ["Employee", "Regular Hours", "Overtime Hours", "Hourly Rate", "Gross Pay"],
      run.lines.map((l) => [l.employeeName, l.regularHours.toFixed(2), l.overtimeHours.toFixed(2), l.hourlyRate.toFixed(2), l.grossPay.toFixed(2)]),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 print:static print:bg-white print:p-0" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl print:max-h-none print:w-full print:max-w-none print:rounded-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 print:hidden">
          <h3 className="font-bold text-ink">
            Payroll: {new Date(run.summary.periodStart + "T00:00:00").toLocaleDateString()} –{" "}
            {new Date(run.summary.periodEnd + "T00:00:00").toLocaleDateString()}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-bold text-[var(--color-steel)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-bold text-[var(--color-steel)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--color-steel)] hover:bg-hover hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
              <tr>
                <th className="py-2">Employee</th>
                <th className="py-2">Regular</th>
                <th className="py-2">OT</th>
                <th className="py-2">Rate</th>
                <th className="py-2">Gross</th>
              </tr>
            </thead>
            <tbody>
              {run.lines.map((l) => (
                <tr key={l.profileId || l.employeeName} className="border-b border-line last:border-0">
                  <td className="py-2.5 font-semibold text-ink">{l.employeeName}</td>
                  <td className="py-2.5 text-[var(--color-steel)]">{l.regularHours.toFixed(2)}</td>
                  <td className="py-2.5 text-[var(--color-steel)]">{l.overtimeHours.toFixed(2)}</td>
                  <td className="py-2.5 text-[var(--color-steel)]">{formatCurrency(l.hourlyRate)}</td>
                  <td className="py-2.5 font-semibold text-ink">{formatCurrency(l.grossPay)}</td>
                </tr>
              ))}
              <tr className="font-bold text-ink">
                <td className="py-2.5" colSpan={4}>
                  Total
                </td>
                <td className="py-2.5">{formatCurrency(run.lines.reduce((s, l) => s + l.grossPay, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [period, setPeriod] = useState(currentMonth());
  const [rows, setRows] = useState<BudgetVsActual[] | null>(null);

  useEffect(() => {
    getBudgetVsActual(period).then(setRows);
  }, [period]);

  function handleExport() {
    if (!rows) return;
    downloadCsv(
      `budget_vs_actual_${period}.csv`,
      ["Category", "Budgeted", "Actual", "Variance"],
      rows.map((r) => [r.category, r.budgeted.toFixed(2), r.actual.toFixed(2), (r.budgeted - r.actual).toFixed(2)]),
    );
  }

  const totalBudgeted = rows?.reduce((s, r) => s + r.budgeted, 0) ?? 0;
  const totalActual = rows?.reduce((s, r) => s + r.actual, 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">Period</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-bold text-[var(--color-steel)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-bold text-[var(--color-steel)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Always white/black, never theme-aware — this represents a printed paper document. */}
      <div className="rounded-2xl border border-black/10 bg-white p-8 text-[#1c2024] shadow-sm">
        <h2 className="mb-1 text-xl font-bold">Budget vs. Actual</h2>
        <p className="mb-6 text-sm text-[#5b6570]">Period: {period}</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/10 text-xs font-bold uppercase tracking-wide text-[#5b6570]">
            <tr>
              <th className="py-2">Category</th>
              <th className="py-2">Budgeted</th>
              <th className="py-2">Actual</th>
              <th className="py-2">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.category} className="border-b border-black/10 last:border-0">
                <td className="py-2.5 font-semibold">{r.category}</td>
                <td className="py-2.5">{formatCurrency(r.budgeted)}</td>
                <td className="py-2.5">{formatCurrency(r.actual)}</td>
                <td className={`py-2.5 font-semibold ${r.budgeted - r.actual < 0 ? "text-red-600" : ""}`}>
                  {formatCurrency(r.budgeted - r.actual)}
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#5b6570]">
                  No budget or expense data for this period.
                </td>
              </tr>
            )}
            {rows && rows.length > 0 && (
              <tr className="font-bold">
                <td className="py-2.5">Total</td>
                <td className="py-2.5">{formatCurrency(totalBudgeted)}</td>
                <td className="py-2.5">{formatCurrency(totalActual)}</td>
                <td className={`py-2.5 ${totalBudgeted - totalActual < 0 ? "text-red-600" : ""}`}>
                  {formatCurrency(totalBudgeted - totalActual)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
