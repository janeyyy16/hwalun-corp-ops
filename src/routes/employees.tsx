import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ClipboardList, Pencil, Plus, Search, UserPlus, X } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { activityActionLabel, getActivityLog, logActivity, type HrActivityLogEntry } from "@/lib/hrActivityLog";

export const Route = createFileRoute("/employees")({
  component: Employees,
});

interface RoleOption {
  id: string;
  key: string;
  label: string;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  start_date: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  role: { label: string } | null;
}

type FormState = "idle" | "submitting" | "error";

const EMPLOYEE_SELECT =
  "id, full_name, email, created_at, first_name, last_name, phone, address, start_date, date_of_birth, emergency_contact_name, emergency_contact_phone, role:roles(label)";

function Employees() {
  const { canManageEmployees, canManageUsers, session } = useAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<FormState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [showLogs, setShowLogs] = useState(false);

  async function loadEmployees() {
    const { data } = await supabase.from("profiles").select(EMPLOYEE_SELECT).order("created_at", { ascending: false });
    setEmployees((data ?? []) as unknown as Employee[]);
  }

  useEffect(() => {
    if (!canManageUsers) return;
    loadEmployees();
    supabase
      .from("roles")
      .select("id, key, label")
      .then(({ data }) => setRoles(data ?? []));
  }, [canManageUsers]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const full_name = form.get("full_name") as string;
    const email = form.get("email") as string;
    const role_id = form.get("role_id") as string;

    setFormState("submitting");
    setFormError(null);

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ full_name, email, role_id }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormState("error");
      setFormError(body.error ?? "Failed to add user.");
      return;
    }

    formEl.reset();
    setFormState("idle");
    setShowForm(false);
    await logActivity({ action: "employee_added", targetLabel: full_name });
    loadEmployees();
  }

  const filteredEmployees = employees?.filter((emp) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return emp.full_name.toLowerCase().includes(q) || emp.email.toLowerCase().includes(q);
  });

  if (!canManageUsers) {
    return (
      <DashboardShell title="User Management">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <p className="text-sm text-[var(--color-steel)]">You don't have access to this page.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="User Management" subtitle="Manage who has access to the operations portal.">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-steel)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full rounded-full border border-line-strong bg-surface py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-bold text-[var(--color-steel)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <ClipboardList className="h-4 w-4" />
            Logs
          </button>
          {canManageEmployees && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancel" : "Add User"}
            </button>
          )}
        </div>
      </div>

      {canManageEmployees && showForm && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-bold text-ink">New User</h2>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Full Name</label>
              <input
                name="full_name"
                type="text"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Role</label>
              <select
                name="role_id"
                required
                defaultValue=""
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                <option value="" disabled>
                  Select a role
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{formError}</p>}
            <p className="text-xs text-[var(--color-steel)] sm:col-span-2">
              New accounts are created with the default password. Relay it to the user directly.
            </p>
            <button
              type="submit"
              disabled={formState === "submitting"}
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
            >
              {formState === "submitting" ? "Creating…" : "Create User"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Start Date</th>
              <th className="px-6 py-3">Added</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {filteredEmployees?.map((emp) => (
              <tr key={emp.id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 font-semibold text-ink">{emp.full_name}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{emp.email}</td>
                <td className="px-6 py-3.5">
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                    {emp.role?.label ?? "—"}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">
                  {emp.start_date ? new Date(emp.start_date + "T00:00:00").toLocaleDateString() : "—"}
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">
                  {new Date(emp.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-3.5">
                  <button
                    type="button"
                    onClick={() => setEditing(emp)}
                    title="View / edit profile"
                    className="text-[var(--color-steel)] hover:text-[var(--color-primary)]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredEmployees && filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  {employees && employees.length > 0 ? "No users match your search." : "No users yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditEmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadEmployees();
          }}
        />
      )}

      {showLogs && <LogsModal onClose={() => setShowLogs(false)} />}
    </DashboardShell>
  );
}

function EditEmployeeModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("saving");
    setError(null);
    const { error: rpcError } = await supabase.rpc("update_employee_profile", {
      p_profile_id: employee.id,
      p_first_name: (form.get("first_name") as string) || null,
      p_last_name: (form.get("last_name") as string) || null,
      p_phone: (form.get("phone") as string) || null,
      p_address: (form.get("address") as string) || null,
      p_start_date: (form.get("start_date") as string) || null,
      p_date_of_birth: (form.get("date_of_birth") as string) || null,
      p_emergency_contact_name: (form.get("emergency_contact_name") as string) || null,
      p_emergency_contact_phone: (form.get("emergency_contact_phone") as string) || null,
    });
    if (rpcError) {
      setStatus("error");
      setError(rpcError.message);
      return;
    }
    await logActivity({ action: "employee_profile_updated", targetLabel: employee.full_name });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-bold text-ink">{employee.full_name}'s Profile</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--color-steel)] hover:bg-hover hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <EmployeeField label="First Name" name="first_name" defaultValue={employee.first_name ?? ""} />
            <EmployeeField label="Last Name" name="last_name" defaultValue={employee.last_name ?? ""} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Email</label>
              <input
                value={employee.email}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-line-strong bg-subtle px-4 py-2.5 text-sm text-[var(--color-steel)] outline-none"
              />
            </div>
            <EmployeeField label="Phone" name="phone" type="tel" defaultValue={employee.phone ?? ""} />
            <EmployeeField label="Start Date" name="start_date" type="date" defaultValue={employee.start_date ?? ""} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Address</label>
              <input
                name="address"
                defaultValue={employee.address ?? ""}
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <EmployeeField label="Date of Birth" name="date_of_birth" type="date" defaultValue={employee.date_of_birth ?? ""} />
            <div />
            <EmployeeField
              label="Emergency Contact Name"
              name="emergency_contact_name"
              defaultValue={employee.emergency_contact_name ?? ""}
            />
            <EmployeeField
              label="Emergency Contact Phone"
              name="emergency_contact_phone"
              type="tel"
              defaultValue={employee.emergency_contact_phone ?? ""}
            />
          </div>
          {status === "error" && error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={status === "saving"}
            className="mt-5 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
          >
            {status === "saving" ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmployeeField({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  );
}

function LogsModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<HrActivityLogEntry[] | null>(null);

  useEffect(() => {
    getActivityLog().then(setEntries);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-bold text-ink">Activity Log</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--color-steel)] hover:bg-hover hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-line bg-surface text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target</th>
              </tr>
            </thead>
            <tbody>
              {entries?.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap text-[var(--color-steel)]">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{e.actorName ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                      {activityActionLabel(e.action)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-steel)]">{e.targetLabel ?? "—"}</td>
                </tr>
              ))}
              {entries && entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[var(--color-steel)]">
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
