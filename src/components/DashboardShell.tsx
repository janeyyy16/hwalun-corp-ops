import { Link, useLocation } from "@tanstack/react-router";
import { Building2, LayoutDashboard, LogOut, Settings as SettingsIcon, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth, type RoleKey } from "@/lib/auth";

const NAV: { to: string; label: string; icon: typeof Users; roles: RoleKey[] | null }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/employees", label: "Employees", icon: Users, roles: ["super_admin", "hr"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: null },
];

export function DashboardShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-black/5 bg-white">
        <div className="flex items-center gap-2.5 border-b border-black/5 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-[#1c2024]">HWA LUN</p>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-steel)]">Operations</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.filter((item) => !item.roles || (profile && item.roles.includes(profile.role.key))).map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-steel)] hover:bg-black/5 hover:text-[#1c2024]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/5 p-4">
          <div className="rounded-xl bg-[#141618] p-4 text-white">
            <p className="text-sm font-bold">Hwa Lun Corporation</p>
            <p className="mt-1 text-xs text-white/60">Internal operations portal.</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-8 py-4">
          <div>
            <h1 className="text-xl font-bold text-[#1c2024]">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-[var(--color-steel)]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-4">
            {profile && (
              <div className="text-right">
                <p className="text-sm font-bold text-[#1c2024]">{profile.full_name}</p>
                <p className="text-xs text-[var(--color-steel)]">{profile.role.label}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-bold text-[var(--color-steel)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
