import { Link, useLocation } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  Clock,
  LayoutDashboard,
  Menu,
  Settings as SettingsIcon,
  UsersRound,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth, type RoleKey } from "@/lib/auth";
import { TimeClockButtons } from "@/components/TimeClockButtons";
import { ProfileMenu } from "@/components/ProfileMenu";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  roles: RoleKey[] | null;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: null,
    children: [
      { to: "/hr-recruitment", label: "HR & Recruitment", icon: UsersRound, roles: ["super_admin", "hr"] },
      {
        to: "/accounting-finance",
        label: "Accounting and Finance",
        icon: Briefcase,
        roles: ["super_admin", "accounting_finance"],
      },
    ],
  },
  { to: "/employees", label: "User Management", icon: Users, roles: ["super_admin", "hr"] },
  { to: "/my-timecard", label: "My Timecard", icon: Clock, roles: null },
  { to: "/timecard-logs", label: "Timecard Logs", icon: Calendar, roles: null },
  { to: "/my-pto", label: "My PTO", icon: CalendarDays, roles: null },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: null },
];

export function DashboardShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* Sidebar */}
      <aside
        className={`flex shrink-0 flex-col border-r border-black/5 bg-white transition-[width] duration-200 print:hidden ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-black/5 px-4 py-5">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-steel)] transition-colors hover:bg-black/5 hover:text-[#1c2024]"
          >
            <Menu className="h-5 w-5" />
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight text-[#1c2024]">HWA LUN</p>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--color-steel)]">
                  Operations
                </p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.filter((item) => !item.roles || (profile && item.roles.includes(profile.role.key))).map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            const children = (item.children ?? []).filter(
              (child) => !child.roles || (profile && child.roles.includes(profile.role.key)),
            );
            const childActive = children.some((child) => location.pathname === child.to);

            return (
              <div key={item.to}>
                <div className="flex items-center gap-1">
                  <Link
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${
                      active || (collapsed && childActive)
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-steel)] hover:bg-black/5 hover:text-[#1c2024]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                  {!collapsed && children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDashboardOpen((o) => !o)}
                      aria-label={dashboardOpen ? "Collapse section" : "Expand section"}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-steel)] transition-colors hover:bg-black/5 hover:text-[#1c2024]"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${dashboardOpen ? "" : "-rotate-90"}`} />
                    </button>
                  )}
                </div>

                {!collapsed && children.length > 0 && dashboardOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-black/10 pl-3">
                    {children.map((child) => {
                      const ChildIcon = child.icon;
                      const childOne = location.pathname === child.to;
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            childOne
                              ? "bg-[var(--color-primary)] text-white"
                              : "text-[var(--color-steel)] hover:bg-black/5 hover:text-[#1c2024]"
                          }`}
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="border-t border-black/5 p-4">
            <div className="rounded-xl bg-[#141618] p-4 text-white">
              <p className="text-sm font-bold">Hwa Lun Corporation</p>
              <p className="mt-1 text-xs text-white/60">Internal operations portal.</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-8 py-4 print:hidden">
          <div>
            <h1 className="text-xl font-bold text-[#1c2024]">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-[var(--color-steel)]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-4">
            <TimeClockButtons />
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
