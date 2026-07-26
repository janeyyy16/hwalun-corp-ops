import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
  role: { label: string } | null;
}

type FormState = "idle" | "submitting" | "error";

function Employees() {
  const { canManageEmployees, session } = useAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<FormState>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  async function loadEmployees() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at, role:roles(label)")
      .order("created_at", { ascending: false });
    setEmployees((data ?? []) as unknown as Employee[]);
  }

  useEffect(() => {
    if (!canManageEmployees) return;
    loadEmployees();
    supabase
      .from("roles")
      .select("id, key, label")
      .then(({ data }) => setRoles(data ?? []));
  }, [canManageEmployees]);

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
      setFormError(body.error ?? "Failed to add employee.");
      return;
    }

    formEl.reset();
    setFormState("idle");
    setShowForm(false);
    loadEmployees();
  }

  if (!canManageEmployees) {
    return (
      <DashboardShell title="Employees">
        <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
          <p className="text-sm text-[var(--color-steel)]">You don't have access to this page.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Employees" subtitle="Manage who has access to the operations portal.">
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Employee"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-bold text-[#1c2024]">New Employee</h2>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Full Name</label>
              <input
                name="full_name"
                type="text"
                required
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Role</label>
              <select
                name="role_id"
                required
                defaultValue=""
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
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
              New accounts are created with the default password. Relay it to the employee directly.
            </p>
            <button
              type="submit"
              disabled={formState === "submitting"}
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
            >
              {formState === "submitting" ? "Creating…" : "Create Employee"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Added</th>
            </tr>
          </thead>
          <tbody>
            {employees?.map((emp) => (
              <tr key={emp.id} className="border-b border-black/5 last:border-0">
                <td className="px-6 py-3.5 font-semibold text-[#1c2024]">{emp.full_name}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{emp.email}</td>
                <td className="px-6 py-3.5">
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                    {emp.role?.label ?? "—"}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">
                  {new Date(emp.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {employees && employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
