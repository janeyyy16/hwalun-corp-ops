import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getUnreadMeetingInvites, markMeetingRead, subscribeToMeetingChanges, type Meeting } from "@/lib/meetings";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function NotificationsMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<Meeting[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function reload() {
    setInvites(await getUnreadMeetingInvites());
  }

  useEffect(() => {
    reload();
    const unsubscribe = subscribeToMeetingChanges(() => reload());
    return unsubscribe;
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpenInvite(meeting: Meeting) {
    setOpen(false);
    await markMeetingRead(meeting.id);
    await reload();
    navigate({ to: "/meeting-calendar" });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-steel)] transition-colors hover:bg-hover hover:text-ink"
      >
        <Bell className="h-5 w-5" />
        {invites && invites.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <p className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            Notifications
          </p>
          <div className="max-h-80 overflow-y-auto">
            {invites?.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleOpenInvite(m)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-hover"
              >
                <p className="text-sm font-semibold text-ink">Meeting invite: {m.title}</p>
                <p className="text-xs text-[var(--color-steel)]">
                  {new Date(m.meetingDate + "T00:00:00").toLocaleDateString()} · {formatTime(m.startTime)}
                </p>
              </button>
            ))}
            {invites && invites.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-steel)]">No new notifications.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
