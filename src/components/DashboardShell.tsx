import { Link, useLocation } from "@tanstack/react-router";
import {
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock,
  LayoutDashboard,
  MessageSquare,
  Menu,
  Moon,
  Settings as SettingsIcon,
  Sun,
  UsersRound,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, type RoleKey } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { TimeClockButtons } from "@/components/TimeClockButtons";
import { ProfileMenu } from "@/components/ProfileMenu";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { hasUnreadMessages, subscribeToNewMessages } from "@/lib/messaging";
import logo from "@/assets/images/logo.png";
import logoIcon from "@/assets/images/logo-icon.png";

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
  { to: "/employees", label: "User Management", icon: Users, roles: ["super_admin", "hr", "admin"] },
  { to: "/my-timecard", label: "My Timecard", icon: Clock, roles: null },
  { to: "/timecard-logs", label: "Timecard Logs", icon: Calendar, roles: null },
  { to: "/my-pto", label: "My PTO", icon: CalendarDays, roles: null },
  { to: "/meeting-calendar", label: "Meeting Calendar", icon: CalendarClock, roles: null },
  { to: "/settings", label: "Profile Settings", icon: SettingsIcon, roles: null },
];

export function DashboardShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(false);

  useEffect(() => {
    hasUnreadMessages().then(setUnreadMessages);
    const unsubscribe = subscribeToNewMessages(() => {
      hasUnreadMessages().then(setUnreadMessages);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* Sidebar */}
      <aside
        className={`flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 print:hidden ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="border-b border-line px-4 py-4">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-steel)] transition-colors hover:bg-hover hover:text-ink"
          >
            <Menu className="h-5 w-5" />
          </button>
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
                        : "text-[var(--color-steel)] hover:bg-hover hover:text-ink"
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
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-steel)] transition-colors hover:bg-hover hover:text-ink"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${dashboardOpen ? "" : "-rotate-90"}`} />
                    </button>
                  )}
                </div>

                {!collapsed && children.length > 0 && dashboardOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-line-strong pl-3">
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
                              : "text-[var(--color-steel)] hover:bg-hover hover:text-ink"
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

        <div className={`border-t border-line p-4 ${collapsed ? "flex justify-center" : ""}`}>
          {collapsed ? (
            <img src={logoIcon} alt="Hwa Lun Corporation" className="h-9 w-auto" />
          ) : (
            <img src={logo} alt="Hwa Lun Corporation" className="h-11 w-auto" />
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-8 py-4 print:hidden">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide text-ink">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-[var(--color-steel)]">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <TimeClockButtons />
            <div className="mx-1 h-6 w-px bg-line-strong" />
            <Link
              to="/messages"
              aria-label="Open Messages"
              title="Open Messages"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-steel)] transition-colors hover:bg-hover hover:text-ink"
            >
              <MessageSquare className="h-5 w-5" />
              {unreadMessages && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
            </Link>
            <NotificationsMenu />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-steel)] transition-colors hover:bg-hover hover:text-ink"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
