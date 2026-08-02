import { Link } from "@tanstack/react-router";
import { ChevronDown, Clock, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ProfileMenu() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!profile) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-line-strong py-1.5 pl-1.5 pr-3 transition-colors hover:border-[var(--color-primary)]"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
          {initials(profile.full_name)}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold leading-tight text-ink">{profile.full_name}</p>
          <p className="text-xs leading-tight text-[var(--color-steel)]">{profile.role.label}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-[var(--color-steel)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-lg">
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-hover"
          >
            <UserRound className="h-4 w-4 text-[var(--color-steel)]" />
            My Profile
          </Link>
          <Link
            to="/my-timecard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-hover"
          >
            <Clock className="h-4 w-4 text-[var(--color-steel)]" />
            My Timecard
          </Link>
          <div className="my-1.5 border-t border-line" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
