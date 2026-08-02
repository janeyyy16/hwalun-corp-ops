import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getEntryForDate, nowTime, saveEntry, todayKey, type TimeEntry } from "@/lib/hrTimecard";

const EMPTY_ENTRY: TimeEntry = { checkIn: "", checkOut: "", mealStart: "", mealEnd: "", notes: "" };

function fmtTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Quick Time In / Meal In / Meal Out / Time Out punch clock in the header.
 * Each step gates the next: Meal In needs Time In, Meal Out needs Meal In,
 * Time Out needs Time In. Once punched, the recorded time is stamped
 * underneath the button (read from the saved entry, so it survives a
 * refresh) rather than shown as a transient toast.
 */
export function TimeClockButtons() {
  const { profile } = useAuth();
  const [entry, setEntry] = useState<TimeEntry>(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    getEntryForDate(profile.id, todayKey())
      .then(setEntry)
      .catch((err) => console.error("Failed to load today's timecard entry:", err));
  }, [profile?.id]);

  if (!profile) return null;

  async function persist(next: TimeEntry) {
    setSaving(true);
    setEntry(next);
    try {
      await saveEntry(profile!.id, todayKey(), next);
    } catch (err) {
      console.error("Failed to save time punch:", err);
      setEntry(entry);
    } finally {
      setSaving(false);
    }
  }

  const btnClass =
    "rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-30";
  const stampClass = "pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold";

  return (
    <div className="flex h-9 items-center gap-1 rounded-full border border-line-strong bg-subtle px-1">
      <div className="relative">
        <button
          type="button"
          onClick={() => !entry.checkIn && persist({ ...entry, checkIn: nowTime() })}
          disabled={saving || !!entry.checkIn}
          className={`${btnClass} text-green-700 hover:bg-green-500/10`}
        >
          Time In
        </button>
        {entry.checkIn && <span className={`${stampClass} text-green-700/80`}>{fmtTime(entry.checkIn)}</span>}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => entry.checkIn && !entry.checkOut && !entry.mealStart && persist({ ...entry, mealStart: nowTime() })}
          disabled={saving || !entry.checkIn || !!entry.checkOut || !!entry.mealStart}
          className={`${btnClass} text-orange-700 hover:bg-orange-500/10`}
        >
          Meal In
        </button>
        {entry.mealStart && <span className={`${stampClass} text-orange-700/80`}>{fmtTime(entry.mealStart)}</span>}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => entry.mealStart && !entry.mealEnd && !entry.checkOut && persist({ ...entry, mealEnd: nowTime() })}
          disabled={saving || !entry.mealStart || !!entry.mealEnd || !!entry.checkOut}
          className={`${btnClass} text-orange-700 hover:bg-orange-500/10`}
        >
          Meal Out
        </button>
        {entry.mealEnd && <span className={`${stampClass} text-orange-700/80`}>{fmtTime(entry.mealEnd)}</span>}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => entry.checkIn && !entry.checkOut && persist({ ...entry, checkOut: nowTime() })}
          disabled={saving || !entry.checkIn || !!entry.checkOut}
          className={`${btnClass} text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10`}
        >
          Time Out
        </button>
        {entry.checkOut && <span className={`${stampClass} text-[var(--color-primary)]/80`}>{fmtTime(entry.checkOut)}</span>}
      </div>
    </div>
  );
}
