import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { calcWorkedHours, getMonthEntries, type TimeEntry } from "@/lib/hrTimecard";

export const Route = createFileRoute("/timecard-logs")({
  component: TimecardLogs,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function TimecardLogs() {
  const { profile } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState<Record<string, TimeEntry>>({});
  const [selectedDay, setSelectedDay] = useState("");

  useEffect(() => {
    if (!profile) return;
    getMonthEntries(profile.id, viewYear, viewMonth).then(setEntries);
  }, [profile?.id, viewYear, viewMonth]);

  if (!profile) return null;

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function goToMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay("");
  }

  const selectedEntry = selectedDay ? entries[selectedDay] : undefined;

  return (
    <DashboardShell title="Timecard Logs" subtitle="A calendar view of your recorded check-ins and check-outs.">
      <div className="mb-6 max-w-3xl rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-steel)] hover:bg-hover hover:text-ink"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-steel)] hover:bg-hover hover:text-ink"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-steel)]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-0.5">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} className="h-14" />;
            const key = dateKey(viewYear, viewMonth, day);
            const entry = entries[key];
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelectedDay(key === selectedDay ? "" : key)}
                className={`h-14 rounded-lg border p-1 text-left transition-colors ${
                  isSelected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                    : isToday
                      ? "border-[var(--color-primary)]/40"
                      : "border-line hover:border-line-strong"
                }`}
              >
                <p className={`text-[11px] font-bold ${isToday ? "text-[var(--color-primary)]" : "text-ink"}`}>{day}</p>
                {entry?.checkIn && (
                  <p className="truncate text-[9px] font-semibold leading-tight text-green-700">In {entry.checkIn.slice(0, 5)}</p>
                )}
                {entry?.checkOut && (
                  <p className="truncate text-[9px] font-semibold leading-tight text-[var(--color-primary)]">
                    Out {entry.checkOut.slice(0, 5)}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--color-steel)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-600" /> Check In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" /> Check Out
          </span>
        </div>
      </div>

      {selectedDay && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Check In</th>
                <th className="px-6 py-3">Check Out</th>
                <th className="px-6 py-3">Meal Start</th>
                <th className="px-6 py-3">Meal End</th>
                <th className="px-6 py-3">Hours</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-2.5 font-semibold text-ink">{new Date(selectedDay).toLocaleDateString()}</td>
                <td className="px-6 py-2.5 text-[var(--color-steel)]">{selectedEntry?.checkIn || "—"}</td>
                <td className="px-6 py-2.5 text-[var(--color-steel)]">{selectedEntry?.checkOut || "—"}</td>
                <td className="px-6 py-2.5 text-[var(--color-steel)]">{selectedEntry?.mealStart || "—"}</td>
                <td className="px-6 py-2.5 text-[var(--color-steel)]">{selectedEntry?.mealEnd || "—"}</td>
                <td className="px-6 py-2.5 text-[var(--color-steel)]">
                  {selectedEntry ? calcWorkedHours(selectedEntry).toFixed(2) : "0.00"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
