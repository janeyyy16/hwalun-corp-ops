import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { createTimecardCorrection, getMyTimecardCorrections, type TimecardCorrection } from "@/lib/hrTimecard";

export const Route = createFileRoute("/my-timecard")({
  component: MyTimecard,
});

function MyTimecard() {
  const { profile } = useAuth();
  const [corrections, setCorrections] = useState<TimecardCorrection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!profile) return;
    setCorrections(await getMyTimecardCorrections(profile.id));
  }

  useEffect(() => {
    reload();
  }, [profile?.id]);

  if (!profile) return null;

  async function handleCorrectionSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    try {
      await createTimecardCorrection({
        profileId: profile!.id,
        employeeName: profile!.full_name,
        workDate: form.get("work_date") as string,
        correctedCheckIn: form.get("check_in") as string,
        correctedCheckOut: form.get("check_out") as string,
        correctedMealStart: (form.get("meal_start") as string) || undefined,
        correctedMealEnd: (form.get("meal_end") as string) || undefined,
        reason: form.get("reason") as string,
      });
      (e.currentTarget as HTMLFormElement).reset();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit correction.");
    }
  }

  return (
    <DashboardShell
      title="My Timecard"
      subtitle="Punch in from the header — see your recorded time on Timecard Logs, and request corrections here."
    >
      <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">Request a Correction</h2>
        <form onSubmit={handleCorrectionSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Date</label>
            <input
              name="work_date"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Corrected Check In</label>
            <input
              name="check_in"
              type="time"
              required
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Corrected Check Out</label>
            <input
              name="check_out"
              type="time"
              required
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Meal Start</label>
            <input
              name="meal_start"
              type="time"
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Meal End</label>
            <input
              name="meal_end"
              type="time"
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-ink">Reason</label>
            <textarea
              name="reason"
              rows={2}
              required
              className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
          <button
            type="submit"
            className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 sm:col-span-2 sm:w-fit"
          >
            Submit Correction
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Requested Change</th>
              <th className="px-6 py-3">Reason</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {corrections?.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 font-semibold text-ink">{new Date(c.workDate).toLocaleDateString()}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">
                  {c.correctedCheckIn} – {c.correctedCheckOut}
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{c.reason}</td>
                <td className="px-6 py-3.5">
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                    {c.status[0].toUpperCase() + c.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
            {corrections && corrections.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No corrections requested yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
