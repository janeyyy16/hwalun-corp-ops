import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { FileText, Plus, Printer, Trash2, Upload, UserPlus, X } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  addCandidate,
  deleteCandidate,
  getCandidateCvUrl,
  getCandidates,
  updateCandidateStatus,
  uploadCandidateCv,
  type Candidate,
  type CandidateStatus,
} from "@/lib/hrCandidates";
import {
  addOnboardingDocument,
  deleteOnboardingDocument,
  getOnboardingDocumentUrl,
  getOnboardingDocuments,
  type OnboardingDocument,
} from "@/lib/hrOnboarding";
import { addCoeDocument, addWarningForm } from "@/lib/hrWarningsAndCoe";
import { getActivityLog, activityActionLabel, type HrActivityLogEntry } from "@/lib/hrActivityLog";

export const Route = createFileRoute("/hr-recruitment")({
  component: HrRecruitment,
});

interface EmployeeOption {
  id: string;
  full_name: string;
}

type Tab = "candidates" | "onboarding" | "warnings" | "activity";

const TABS: { key: Tab; label: string }[] = [
  { key: "candidates", label: "Candidates" },
  { key: "onboarding", label: "Onboarding Documents" },
  { key: "warnings", label: "Warnings & COE" },
  { key: "activity", label: "Activity Log" },
];

function HrRecruitment() {
  const { canManageEmployees } = useAuth();
  const [tab, setTab] = useState<Tab>("candidates");

  if (!canManageEmployees) {
    return (
      <DashboardShell title="HR & Recruitment">
        <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
          <p className="text-sm text-[var(--color-steel)]">You don't have access to this page.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="HR & Recruitment" subtitle="Manage hiring, onboarding, and employee HR records.">
      <div className="mb-6 flex flex-wrap gap-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.key
                ? "bg-[var(--color-primary)] text-white"
                : "bg-white text-[var(--color-steel)] hover:text-[#1c2024]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "candidates" && <CandidatesTab />}
      {tab === "onboarding" && <OnboardingTab />}
      {tab === "warnings" && <WarningsCoeTab />}
      {tab === "activity" && <ActivityLogTab />}
    </DashboardShell>
  );
}

async function getEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
  return (data ?? []) as EmployeeOption[];
}

// ── Candidates ──────────────────────────────────────────────────────────

const CANDIDATE_STATUSES: CandidateStatus[] = ["applied", "interviewing", "hired", "rejected"];

function CandidatesTab() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setCandidates(await getCandidates());
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    setFormError(null);
    try {
      await addCandidate({
        fullName: form.get("full_name") as string,
        phone: (form.get("phone") as string) || undefined,
        email: (form.get("email") as string) || undefined,
        position: (form.get("position") as string) || undefined,
        department: (form.get("department") as string) || undefined,
        notes: (form.get("notes") as string) || undefined,
      });
      formEl.reset();
      setShowForm(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add candidate.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(candidate: Candidate, status: CandidateStatus) {
    await updateCandidateStatus(candidate.id, candidate.fullName, status);
    await reload();
  }

  async function handleDelete(candidate: Candidate) {
    await deleteCandidate(candidate.id, candidate.fullName);
    await reload();
  }

  async function handleUploadCv(candidate: Candidate, file: File) {
    await uploadCandidateCv(candidate.id, candidate.fullName, file);
    await reload();
  }

  async function handleViewCv(cvPath: string) {
    const url = await getCandidateCvUrl(cvPath);
    window.open(url, "_blank");
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Candidate"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-bold text-[#1c2024]">New Candidate</h2>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" name="full_name" required />
            <Field label="Position" name="position" />
            <Field label="Phone" name="phone" />
            <Field label="Email" name="email" type="email" />
            <Field label="Department" name="department" />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Notes</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            {formError && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
            >
              {submitting ? "Adding…" : "Add Candidate"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Position</th>
              <th className="px-6 py-3">Contact</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">CV</th>
              <th className="px-6 py-3">Added</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {candidates?.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0">
                <td className="px-6 py-3.5 font-semibold text-[#1c2024]">{c.fullName}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{c.position ?? "—"}</td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{c.email ?? c.phone ?? "—"}</td>
                <td className="px-6 py-3.5">
                  <select
                    value={c.status}
                    onChange={(e) => handleStatusChange(c, e.target.value as CandidateStatus)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-bold text-[var(--color-primary)] outline-none"
                  >
                    {CANDIDATE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2">
                    {c.cvPath && (
                      <button
                        type="button"
                        onClick={() => handleViewCv(c.cvPath!)}
                        className="text-[var(--color-primary)] hover:underline"
                        title="View CV"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                    <label className="cursor-pointer text-[var(--color-steel)] hover:text-[#1c2024]" title="Upload CV">
                      <Upload className="h-4 w-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadCv(c, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-3.5">
                  <button type="button" onClick={() => handleDelete(c)} className="text-[var(--color-steel)] hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {candidates && candidates.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No candidates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  );
}

// ── Onboarding Documents ────────────────────────────────────────────────

function OnboardingTab() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState("");
  const [docs, setDocs] = useState<OnboardingDocument[] | null>(null);
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmployeeOptions().then((opts) => {
      setEmployees(opts);
      if (opts.length > 0) setSelected(opts[0].id);
    });
  }, []);

  async function reload(profileId: string) {
    setDocs(await getOnboardingDocuments(profileId));
  }

  useEffect(() => {
    if (selected) reload(selected);
  }, [selected]);

  const selectedEmployee = employees.find((e) => e.id === selected);

  async function handleUpload(file: File) {
    if (!selected || !selectedEmployee || !category.trim()) {
      setError("Enter a document category before uploading.");
      return;
    }
    setError(null);
    try {
      await addOnboardingDocument(selected, selectedEmployee.full_name, category, file);
      setCategory("");
      await reload(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document.");
    }
  }

  async function handleDelete(doc: OnboardingDocument) {
    if (!selectedEmployee) return;
    await deleteOnboardingDocument(doc.id, selectedEmployee.full_name, doc.category);
    await reload(selected);
  }

  async function handleView(doc: OnboardingDocument) {
    const url = await getOnboardingDocumentUrl(doc.storagePath);
    window.open(url, "_blank");
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Employee</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Document Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder='e.g. "Government ID", "Signed Offer Letter"'
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105">
            <Upload className="h-4 w-4" />
            Upload
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
            <tr>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">File</th>
              <th className="px-6 py-3">Filed</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {docs?.map((d) => (
              <tr key={d.id} className="border-b border-black/5 last:border-0">
                <td className="px-6 py-3.5 font-semibold text-[#1c2024]">{d.category}</td>
                <td className="px-6 py-3.5">
                  <button type="button" onClick={() => handleView(d)} className="text-[var(--color-primary)] hover:underline">
                    {d.fileName}
                  </button>
                </td>
                <td className="px-6 py-3.5 text-[var(--color-steel)]">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-3.5">
                  <button type="button" onClick={() => handleDelete(d)} className="text-[var(--color-steel)] hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {docs && docs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-steel)]">
                  No documents filed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Warnings & Certificates of Employment ───────────────────────────────

function WarningsCoeTab() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    | { kind: "warning"; employeeName: string; reason: string; description: string; issuedAt: string }
    | { kind: "coe"; employeeName: string; jobTitle: string; startDate: string; purpose: string }
    | null
  >(null);

  useEffect(() => {
    getEmployeeOptions().then((opts) => {
      setEmployees(opts);
      if (opts.length > 0) setSelected(opts[0].id);
    });
  }, []);

  const selectedEmployee = employees.find((e) => e.id === selected);

  async function handleWarningSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEmployee) return;
    const form = new FormData(e.currentTarget);
    const reason = form.get("reason") as string;
    const description = form.get("description") as string;
    const issuedAt = (form.get("issued_at") as string) || new Date().toISOString().slice(0, 10);
    setError(null);
    try {
      await addWarningForm(selectedEmployee.id, selectedEmployee.full_name, reason, description, issuedAt);
      setPreview({ kind: "warning", employeeName: selectedEmployee.full_name, reason, description, issuedAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue warning form.");
    }
  }

  async function handleCoeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEmployee) return;
    const form = new FormData(e.currentTarget);
    const jobTitle = form.get("job_title") as string;
    const startDate = form.get("start_date") as string;
    const purpose = (form.get("purpose") as string) || "";
    setError(null);
    try {
      await addCoeDocument(selectedEmployee.id, selectedEmployee.full_name, jobTitle, startDate, purpose);
      setPreview({ kind: "coe", employeeName: selectedEmployee.full_name, jobTitle, startDate, purpose });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate certificate.");
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-black/5 bg-white p-6 shadow-sm print:hidden">
        <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Employee</label>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setPreview(null);
          }}
          className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2 print:hidden">
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-[#1c2024]">Issue Warning</h2>
          <form onSubmit={handleWarningSubmit} className="space-y-4">
            <Field label="Reason" name="reason" required />
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Description</label>
              <textarea
                name="description"
                rows={4}
                required
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Date Issued</label>
              <input
                name="issued_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
            >
              Generate Warning Form
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-[#1c2024]">Generate Certificate of Employment</h2>
          <form onSubmit={handleCoeSubmit} className="space-y-4">
            <Field label="Job Title" name="job_title" required />
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Start Date</label>
              <input
                name="start_date"
                type="date"
                required
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Purpose</label>
              <input
                name="purpose"
                placeholder="e.g. Visa application, loan application"
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105"
            >
              Generate Certificate
            </button>
          </form>
        </div>
      </div>

      {error && <p className="mb-6 text-sm font-semibold text-red-600 print:hidden">{error}</p>}

      {preview && (
        <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-[var(--color-steel)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </button>
          </div>
          <div className="mx-auto max-w-2xl text-sm leading-relaxed text-[#1c2024]">
            <div className="mb-8 text-center">
              <p className="text-lg font-bold">HWA LUN CORPORATION</p>
              <p className="text-xs text-[var(--color-steel)]">Internal operations portal</p>
            </div>
            {preview.kind === "warning" ? (
              <>
                <h3 className="mb-4 text-center text-base font-bold uppercase">Employee Warning Notice</h3>
                <p className="mb-4">Date: {new Date(preview.issuedAt).toLocaleDateString()}</p>
                <p className="mb-4">To: {preview.employeeName}</p>
                <p className="mb-4">Reason: {preview.reason}</p>
                <p className="whitespace-pre-wrap">{preview.description}</p>
              </>
            ) : (
              <>
                <h3 className="mb-4 text-center text-base font-bold uppercase">Certificate of Employment</h3>
                <p className="mb-4">To Whom It May Concern:</p>
                <p className="mb-4">
                  This is to certify that <strong>{preview.employeeName}</strong> is/was employed with Hwa Lun
                  Corporation as <strong>{preview.jobTitle}</strong>, starting {new Date(preview.startDate).toLocaleDateString()}.
                </p>
                {preview.purpose && <p className="mb-4">This certification is issued for {preview.purpose}.</p>}
                <p>Issued this {new Date().toLocaleDateString()}.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity Log ────────────────────────────────────────────────────────

function ActivityLogTab() {
  const [entries, setEntries] = useState<HrActivityLogEntry[] | null>(null);

  useEffect(() => {
    getActivityLog().then(setEntries);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/5 bg-black/[0.02] text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
          <tr>
            <th className="px-6 py-3">When</th>
            <th className="px-6 py-3">Actor</th>
            <th className="px-6 py-3">Action</th>
            <th className="px-6 py-3">Target</th>
          </tr>
        </thead>
        <tbody>
          {entries?.map((e) => (
            <tr key={e.id} className="border-b border-black/5 last:border-0">
              <td className="px-6 py-3.5 text-[var(--color-steel)]">{new Date(e.createdAt).toLocaleString()}</td>
              <td className="px-6 py-3.5 font-semibold text-[#1c2024]">{e.actorName ?? "—"}</td>
              <td className="px-6 py-3.5">
                <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                  {activityActionLabel(e.action)}
                </span>
              </td>
              <td className="px-6 py-3.5 text-[var(--color-steel)]">{e.targetLabel ?? "—"}</td>
            </tr>
          ))}
          {entries && entries.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-steel)]">
                No activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
