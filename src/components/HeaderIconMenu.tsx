import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export function HeaderIconMenu({ icon: Icon, label, emptyText }: { icon: LucideIcon; label: string; emptyText: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-steel)] transition-colors hover:bg-hover hover:text-ink"
      >
        <Icon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <p className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            {label}
          </p>
          <div className="px-4 py-6 text-center text-sm text-[var(--color-steel)]">{emptyText}</div>
        </div>
      )}
    </div>
  );
}
