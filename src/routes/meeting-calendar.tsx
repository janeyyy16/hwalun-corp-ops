import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getCoworkers, type Coworker } from "@/lib/messaging";
import {
  cancelMeeting,
  getMeetingParticipants,
  getMeetingsInRange,
  getRoles,
  markMeetingRead,
  scheduleMeeting,
  subscribeToMeetingChanges,
  type Meeting,
  type MeetingParticipant,
  type RoleOption,
} from "@/lib/meetings";

export const Route = createFileRoute("/meeting-calendar")({
  component: MeetingCalendar,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function MeetingCalendar() {
  const { profile } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [detail, setDetail] = useState<Meeting | null>(null);

  const canSchedule = profile?.role.key === "admin" || profile?.role.key === "super_admin";

  async function reload() {
    const start = dateKey(viewYear, viewMonth, 1);
    const end = dateKey(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
    setMeetings(await getMeetingsInRange(start, end));
  }

  useEffect(() => {
    reload();
    const unsubscribe = subscribeToMeetingChanges(() => reload());
    return unsubscribe;
  }, [viewYear, viewMonth]);

  if (!profile) return null;

  function goToMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay("");
  }

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const meetingsByDay = new Map<string, Meeting[]>();
  for (const m of meetings ?? []) {
    const list = meetingsByDay.get(m.meetingDate) ?? [];
    list.push(m);
    meetingsByDay.set(m.meetingDate, list);
  }
  const selectedMeetings = selectedDay ? (meetingsByDay.get(selectedDay) ?? []) : [];

  return (
    <DashboardShell title="Meeting Calendar" subtitle="Meetings you're invited to.">
      <div className="mb-6 flex max-w-3xl items-center justify-between">
        <div />
        {canSchedule && (
          <button
            type="button"
            onClick={() => setShowSchedule(true)}
            className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
          >
            <CalendarPlus className="h-4 w-4" />
            Schedule Meeting
          </button>
        )}
      </div>

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
            const dayMeetings = meetingsByDay.get(key) ?? [];
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
                {dayMeetings.length > 0 && (
                  <p className="truncate text-[9px] font-semibold leading-tight text-[var(--color-primary)]">
                    {dayMeetings.length === 1 ? dayMeetings[0].title : `${dayMeetings.length} meetings`}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="max-w-3xl overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line px-6 py-3.5">
            <h3 className="text-sm font-bold text-ink">{new Date(selectedDay + "T00:00:00").toLocaleDateString()}</h3>
          </div>
          <div className="divide-y divide-[var(--color-line)]">
            {selectedMeetings.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setDetail(m)}
                className="flex w-full items-center justify-between px-6 py-3.5 text-left hover:bg-hover"
              >
                <div>
                  <p className="font-semibold text-ink">{m.title}</p>
                  <p className="text-xs text-[var(--color-steel)]">
                    {formatTime(m.startTime)}
                    {m.endTime && ` – ${formatTime(m.endTime)}`}
                    {m.location && ` · ${m.location}`}
                  </p>
                  {m.createdByName && (
                    <p className="text-xs text-[var(--color-steel)]">Scheduled by {m.createdByName}</p>
                  )}
                </div>
              </button>
            ))}
            {selectedMeetings.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-[var(--color-steel)]">No meetings this day.</p>
            )}
          </div>
        </div>
      )}

      {showSchedule && (
        <ScheduleMeetingModal
          onClose={() => setShowSchedule(false)}
          onScheduled={() => {
            setShowSchedule(false);
            reload();
          }}
        />
      )}

      {detail && <MeetingDetailModal meeting={detail} canManage={canSchedule} onClose={() => setDetail(null)} onChanged={reload} />}
    </DashboardShell>
  );
}

function MeetingDetailModal({
  meeting,
  canManage,
  onClose,
  onChanged,
}: {
  meeting: Meeting;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [participants, setParticipants] = useState<MeetingParticipant[] | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    markMeetingRead(meeting.id);
    getMeetingParticipants(meeting.id).then(setParticipants);
  }, [meeting.id]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelMeeting(meeting);
      onChanged();
      onClose();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-bold text-ink">{meeting.title}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--color-steel)] hover:bg-hover hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-[var(--color-steel)]">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {new Date(meeting.meetingDate + "T00:00:00").toLocaleDateString()} · {formatTime(meeting.startTime)}
            {meeting.endTime && ` – ${formatTime(meeting.endTime)}`}
          </div>
          {meeting.location && (
            <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-steel)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {meeting.location}
            </div>
          )}
          {meeting.description && <p className="mb-4 text-sm text-ink">{meeting.description}</p>}

          {meeting.createdByName && (
            <p className="mb-4 text-xs text-[var(--color-steel)]">Scheduled by {meeting.createdByName}</p>
          )}

          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">Participants</h4>
          <div className="flex flex-wrap gap-1.5">
            {participants?.map((p) => (
              <span key={p.profileId} className="rounded-full bg-subtle px-3 py-1 text-xs font-semibold text-ink">
                {p.fullName}
              </span>
            ))}
          </div>

          {canManage && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-6 rounded-full border border-line-strong px-5 py-2 text-sm font-bold text-red-600 hover:border-red-600 disabled:opacity-60"
            >
              {cancelling ? "Cancelling…" : "Cancel Meeting"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleMeetingModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const [mode, setMode] = useState<"individuals" | "roles">("individuals");
  const [coworkers, setCoworkers] = useState<Coworker[] | null>(null);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCoworkers().then(setCoworkers);
    getRoles().then(setRoles);
  }, []);

  function togglePerson(id: string) {
    setSelectedPeople((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleRole(key: string) {
    setSelectedRoles((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  const filteredCoworkers = coworkers?.filter((c) => c.fullName.toLowerCase().includes(search.trim().toLowerCase()));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      let participantIds = selectedPeople;
      if (mode === "roles" && selectedRoles.length > 0) {
        const { data, error: roleError } = await supabase.from("profiles").select("id, role:roles(key)");
        if (roleError) throw new Error(roleError.message);
        participantIds = ((data ?? []) as unknown as { id: string; role: { key: string } | null }[])
          .filter((p) => p.role && selectedRoles.includes(p.role.key))
          .map((p) => p.id);
      }
      await scheduleMeeting({
        title: form.get("title") as string,
        description: (form.get("description") as string) || "",
        location: (form.get("location") as string) || "",
        meetingDate: form.get("meeting_date") as string,
        startTime: form.get("start_time") as string,
        endTime: (form.get("end_time") as string) || "",
        participantIds,
      });
      onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule meeting.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-bold text-ink">Schedule Meeting</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--color-steel)] hover:bg-hover hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Title</label>
              <input
                name="title"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Date</label>
              <input
                name="meeting_date"
                type="date"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div />
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Start Time</label>
              <input
                name="start_time"
                type="time"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">End Time (optional)</label>
              <input
                name="end_time"
                type="time"
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Location (optional)</label>
              <input
                name="location"
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Description (optional)</label>
              <textarea
                name="description"
                rows={2}
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("individuals")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  mode === "individuals" ? "bg-[var(--color-primary)] text-white" : "bg-subtle text-[var(--color-steel)]"
                }`}
              >
                Specific People
              </button>
              <button
                type="button"
                onClick={() => setMode("roles")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  mode === "roles" ? "bg-[var(--color-primary)] text-white" : "bg-subtle text-[var(--color-steel)]"
                }`}
              >
                By Role
              </button>
            </div>

            {mode === "individuals" ? (
              <div>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-steel)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search people…"
                    className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-line">
                  {filteredCoworkers?.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-hover">
                      <input
                        type="checkbox"
                        checked={selectedPeople.includes(c.id)}
                        onChange={() => togglePerson(c.id)}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <span className="font-medium text-ink">{c.fullName}</span>
                    </label>
                  ))}
                  {filteredCoworkers && filteredCoworkers.length === 0 && (
                    <p className="px-3 py-4 text-center text-sm text-[var(--color-steel)]">
                      {coworkers && coworkers.length > 0 ? "No matches." : "No other users found."}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-line">
                {roles.map((r) => (
                  <label key={r.key} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.key)}
                      onChange={() => toggleRole(r.key)}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <span className="font-medium text-ink">{r.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
          >
            {submitting ? "Scheduling…" : "Schedule Meeting"}
          </button>
        </form>
      </div>
    </div>
  );
}
