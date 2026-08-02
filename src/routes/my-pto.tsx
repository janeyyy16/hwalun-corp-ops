import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import {
  cancelPtoRequest,
  createPtoRequest,
  getMyProfileStartDate,
  getMyPtoRequests,
  isEligibleForPto,
  ptoDaysUsed,
  ptoEligibleDate,
  ptoYearWindow,
  type PtoRequest,
  type PtoType,
} from "@/lib/hrPto";

export const Route = createFileRoute("/my-pto")({
  component: MyPto,
});

const PTO_TYPES: PtoType[] = ["vacation", "sick", "personal", "unpaid"];

function MyPto() {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [requests, setRequests] = useState<PtoRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    if (!profile) return;
    const [sd, reqs] = await Promise.all([getMyProfileStartDate(profile.id), getMyPtoRequests(profile.id)]);
    setStartDate(sd);
    setRequests(reqs);
  }

  useEffect(() => {
    reload();
  }, [profile?.id]);

  if (!profile) return null;

  const eligible = isEligibleForPto(startDate);
  const window = ptoYearWindow(startDate);
  const used = window && requests ? ptoDaysUsed(requests, window) : 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    setError(null);
    try {
      await createPtoRequest({
        profileId: profile!.id,
        employeeName: profile!.full_name,
        ptoType: form.get("pto_type") as PtoType,
        startDate: form.get("start_date") as string,
        endDate: form.get("end_date") as string,
        reason: (form.get("reason") as string) || undefined,
      });
      formEl.reset();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(request: PtoRequest) {
    await cancelPtoRequest(request.id, profile!.full_name);
    await reload();
  }

  return (
    <DashboardShell title="My PTO" subtitle="Request and track your paid time off.">
      {window ? (
        <div className="mb-6 grid gap-6 sm:grid-cols-3">
          <StatCard label="Tenure Year" value={window.tenureYear} />
          <StatCard label="Annual Allowance" value={`${window.allowance} days`} />
          <StatCard label="Used This Year" value={`${used} days`} />
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <p className="text-sm text-[var(--color-steel)]">
            {eligible
              ? "PTO tracking will begin once your start date is confirmed."
              : `You'll become eligible for PTO on ${ptoEligibleDate(startDate) ?? "—"}.`}
          </p>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">New Request</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Type</label>
            <select
              name="pto_type"
              required
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            >
              {PTO_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Start Date</label>
            <input
              name="start_date"
              type="date"
              required
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">End Date</label>
            <input
              name="end_date"
              type="date"
              required
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-ink">Reason</label>
            <textarea
              name="reason"
              rows={2}
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Dates</th>
              <th className="px-6 py-3">Hours</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {requests?.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 font-semibold text-ink">{r.ptoType[0].toUpperCase() + r.ptoType.slice(1)}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">
                  {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{r.hoursRequested}</td>
                <td className="px-6 py-3.5">
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                    {r.status[0].toUpperCase() + r.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  {r.status === "pending" && (
                    <button type="button" onClick={() => handleCancel(r)} className="text-[var(--color-steel)] hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {requests && requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No PTO requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-sm text-[var(--color-steel)]">{label}</p>
    </div>
  );
}
