import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, Shield, UserCog, Users as UsersIcon, type LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

interface RoleRow {
  role: { label: string } | null;
}

function roleIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes("admin")) return Shield;
  if (lower.includes("account")) return Briefcase;
  return UserCog;
}

function Dashboard() {
  const { profile, canManageEmployees } = useAuth();
  const [total, setTotal] = useState<number | null>(null);
  const [byRole, setByRole] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!canManageEmployees) return;
    supabase
      .from("profiles")
      .select("role:roles(label)")
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as RoleRow[];
        const counts: Record<string, number> = {};
        for (const row of rows) {
          const label = row.role?.label ?? "Unknown";
          counts[label] = (counts[label] ?? 0) + 1;
        }
        setTotal(rows.length);
        setByRole(counts);
      });
  }, [canManageEmployees]);

  return (
    <DashboardShell
      title={`Welcome back, ${profile?.full_name.split(" ")[0] ?? ""}`}
      subtitle="Here's what's happening with operations today."
    >
      {canManageEmployees ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={UsersIcon} label="Total Employees" value={total ?? "…"} />
          {Object.entries(byRole).map(([label, count]) => (
            <StatCard key={label} icon={roleIcon(label)} label={label} value={count} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <p className="text-sm text-[var(--color-steel)]">
            You're signed in as <strong className="text-ink">{profile?.role.label}</strong>. More modules for
            your role are coming soon.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
        <Icon className="h-5 w-5 text-[var(--color-primary)]" />
      </div>
      <p className="mt-4 text-2xl font-bold text-ink">{value}</p>
      <p className="text-sm text-[var(--color-steel)]">{label}</p>
    </div>
  );
}
