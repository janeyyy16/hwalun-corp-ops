import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import {
  getMySignableDocuments,
  getSignedPdfUrl,
  signDocument,
  uploadSignedPdf,
  type SignableDocument,
} from "@/lib/hrSignableDocuments";
import { fillW4Pdf } from "@/lib/w4PdfFill";
import { EMPTY_W4, type W4FormData } from "@/lib/w4FormTemplate";
import { fillW8benPdf } from "@/lib/w8benPdfFill";
import { EMPTY_W8BEN, type W8benFormData } from "@/lib/w8benFormTemplate";
import { fillW9Pdf } from "@/lib/w9PdfFill";
import { EMPTY_W9, type W9FormData } from "@/lib/w9FormTemplate";

export const Route = createFileRoute("/my-documents")({
  component: MyDocuments,
});

const DOCUMENT_LABEL: Record<string, string> = {
  warning_form: "Warning Form",
  w4: "Form W-4",
  w8ben: "Form W-8BEN",
  w9: "Form W-9",
};

const STATUS_LABEL: Record<string, string> = {
  pending_signature: "Awaiting Your Signature",
  signed: "Signed — Awaiting HR Confirmation",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

function MyDocuments() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<SignableDocument[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function reload() {
    if (!profile) return;
    setDocuments(await getMySignableDocuments(profile.id));
  }

  useEffect(() => {
    reload();
  }, [profile?.id]);

  if (!profile) return null;

  const active = documents?.find((d) => d.id === activeId) ?? null;

  return (
    <DashboardShell title="My Documents" subtitle="Warning forms and tax forms awaiting your signature.">
      {active ? (
        <div>
          <button type="button" onClick={() => setActiveId(null)} className="mb-4 text-sm font-semibold text-[var(--color-primary)]">
            ← Back to list
          </button>
          {active.documentType === "warning_form" && (
            <WarningSignForm doc={active} employeeName={profile.full_name} onDone={() => { setActiveId(null); reload(); }} />
          )}
          {active.documentType === "w4" && (
            <W4SignForm doc={active} employeeName={profile.full_name} onDone={() => { setActiveId(null); reload(); }} />
          )}
          {active.documentType === "w8ben" && (
            <W8benSignForm doc={active} employeeName={profile.full_name} onDone={() => { setActiveId(null); reload(); }} />
          )}
          {active.documentType === "w9" && (
            <W9SignForm doc={active} employeeName={profile.full_name} onDone={() => { setActiveId(null); reload(); }} />
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.02] text-xs font-bold uppercase tracking-wide text-[var(--color-steel)]">
              <tr>
                <th className="px-6 py-3">Document</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Received</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents?.map((d) => (
                <tr key={d.id} className="border-b border-black/5 last:border-0">
                  <td className="px-6 py-3.5 font-semibold text-[#1c2024]">{DOCUMENT_LABEL[d.documentType] ?? d.documentType}</td>
                  <td className="px-6 py-3.5">
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-bold text-[var(--color-primary)]">
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-[var(--color-steel)]">{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-3.5">
                    {d.status === "pending_signature" ? (
                      <button type="button" onClick={() => setActiveId(d.id)} className="text-[var(--color-primary)] hover:underline">
                        Review &amp; Sign
                      </button>
                    ) : d.pdfPath ? (
                      <DownloadLink path={d.pdfPath} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {documents && documents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-steel)]">
                    No documents awaiting you.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}

function DownloadLink({ path }: { path: string }) {
  async function handleClick() {
    const url = await getSignedPdfUrl(path);
    window.open(url, "_blank");
  }
  return (
    <button type="button" onClick={handleClick} className="text-[var(--color-primary)] hover:underline">
      Download PDF
    </button>
  );
}

function Field({ label, name, defaultValue = "", required = false }: { label: string; name: string; defaultValue?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  );
}

// ── Warning Form ─────────────────────────────────────────────────────────

function WarningSignForm({ doc, employeeName, onDone }: { doc: SignableDocument; employeeName: string; onDone: () => void }) {
  const data = doc.formData as { reason: string; description: string; issuedAt: string };
  const [signatureName, setSignatureName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signDocument(doc.id, employeeName, signatureName);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
      <div className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-[#1c2024]">
        <div className="mb-8 text-center">
          <p className="text-lg font-bold">HWA LUN CORPORATION</p>
          <p className="text-xs text-[var(--color-steel)]">Internal operations portal</p>
        </div>
        <h3 className="mb-4 text-center text-base font-bold uppercase">Employee Warning Notice</h3>
        <p className="mb-4">Date: {new Date(data.issuedAt).toLocaleDateString()}</p>
        <p className="mb-4">To: {employeeName}</p>
        <p className="mb-4">Reason: {data.reason}</p>
        <p className="whitespace-pre-wrap">{data.description}</p>
      </div>
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 border-t border-black/10 pt-6">
        <label className="flex items-start gap-2 text-sm text-[#1c2024]">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} required className="mt-1" />
          I acknowledge that I have read and received this warning notice.
        </label>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Type your full name to sign</label>
          <input
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            required
            className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={!acknowledged || submitting}
          className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
        >
          {submitting ? "Signing…" : "Sign"}
        </button>
      </form>
    </div>
  );
}

// ── W-4 ──────────────────────────────────────────────────────────────────

const W4_FILING_STATUSES: { value: W4FormData["filingStatus"]; label: string }[] = [
  { value: "single_or_mfs", label: "Single or Married Filing Separately" },
  { value: "married_filing_jointly", label: "Married Filing Jointly" },
  { value: "head_of_household", label: "Head of Household" },
];

function W4SignForm({ doc, employeeName, onDone }: { doc: SignableDocument; employeeName: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const data: W4FormData = {
        ...EMPTY_W4,
        firstNameMiddleInitial: form.get("first_name") as string,
        lastName: form.get("last_name") as string,
        ssn: form.get("ssn") as string,
        address: form.get("address") as string,
        cityStateZip: form.get("city_state_zip") as string,
        filingStatus: form.get("filing_status") as W4FormData["filingStatus"],
        multipleJobsCheckbox: form.get("multiple_jobs") === "on",
        step3ChildrenAmount: (form.get("step3_children") as string) || "",
        step3OtherDependentsAmount: (form.get("step3_other") as string) || "",
        step3TotalAmount: (form.get("step3_total") as string) || "",
        step4aOtherIncome: (form.get("step4a") as string) || "",
        step4bDeductions: (form.get("step4b") as string) || "",
        step4cExtraWithholding: (form.get("step4c") as string) || "",
        exemptCheckbox: form.get("exempt") === "on",
        dateSigned: form.get("date_signed") as string,
        signatureName: form.get("signature_name") as string,
      };
      const bytes = await fillW4Pdf(data);
      const path = await uploadSignedPdf(doc.id, bytes, "w4.pdf");
      await signDocument(doc.id, employeeName, data.signatureName, path, data as unknown as Record<string, unknown>);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#1c2024]">Form W-4: Employee's Withholding Certificate</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="First Name & Middle Initial" name="first_name" required />
        <Field label="Last Name" name="last_name" required />
        <Field label="Social Security Number" name="ssn" required />
        <Field label="Address" name="address" required />
        <Field label="City, State, ZIP" name="city_state_zip" required />
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Filing Status</label>
          <select
            name="filing_status"
            required
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {W4_FILING_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-[#1c2024] sm:col-span-2">
          <input type="checkbox" name="multiple_jobs" /> Step 2(c): only two jobs total
        </label>
        <Field label="Step 3: Qualifying Children Amount" name="step3_children" />
        <Field label="Step 3: Other Dependents Amount" name="step3_other" />
        <Field label="Step 3: Total" name="step3_total" />
        <Field label="Step 4(a): Other Income" name="step4a" />
        <Field label="Step 4(b): Deductions" name="step4b" />
        <Field label="Step 4(c): Extra Withholding" name="step4c" />
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-[#1c2024] sm:col-span-2">
          <input type="checkbox" name="exempt" /> I claim exemption from withholding
        </label>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Date Signed</label>
          <input
            name="date_signed"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <Field label="Type your full name to sign" name="signature_name" required />
        {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
        >
          {submitting ? "Submitting…" : "Sign & Submit"}
        </button>
      </form>
    </div>
  );
}

// ── W-8BEN ───────────────────────────────────────────────────────────────

function W8benSignForm({ doc, employeeName, onDone }: { doc: SignableDocument; employeeName: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const data: W8benFormData = {
        ...EMPTY_W8BEN,
        employeeName: (form.get("employee_name") as string) || employeeName,
        countryOfCitizenship: form.get("country_of_citizenship") as string,
        permanentAddress: {
          street: form.get("permanent_street") as string,
          cityStateZip: form.get("permanent_city_state_zip") as string,
          country: form.get("permanent_country") as string,
        },
        mailingAddress: {
          street: (form.get("mailing_street") as string) || "",
          cityStateZip: (form.get("mailing_city_state_zip") as string) || "",
          country: (form.get("mailing_country") as string) || "",
        },
        usTin: (form.get("us_tin") as string) || "",
        ftin: (form.get("ftin") as string) || "",
        dateOfBirth: form.get("date_of_birth") as string,
        certifiedTrue: form.get("certified") === "on",
        dateSigned: form.get("date_signed") as string,
        signatureName: form.get("signature_name") as string,
      };
      const bytes = await fillW8benPdf(data);
      const path = await uploadSignedPdf(doc.id, bytes, "w8ben.pdf");
      await signDocument(doc.id, employeeName, data.signatureName, path, data as unknown as Record<string, unknown>);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#1c2024]">Form W-8BEN: Certificate of Foreign Status</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="employee_name" defaultValue={employeeName} required />
        <Field label="Country of Citizenship" name="country_of_citizenship" required />
        <Field label="Permanent Address" name="permanent_street" required />
        <Field label="Permanent City, State, ZIP" name="permanent_city_state_zip" required />
        <Field label="Permanent Address Country" name="permanent_country" required />
        <Field label="Mailing Address (if different)" name="mailing_street" />
        <Field label="Mailing City, State, ZIP" name="mailing_city_state_zip" />
        <Field label="Mailing Address Country" name="mailing_country" />
        <Field label="U.S. Taxpayer Identification Number" name="us_tin" />
        <Field label="Foreign Tax Identifying Number" name="ftin" />
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Date of Birth</label>
          <input
            name="date_of_birth"
            type="date"
            required
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-[#1c2024] sm:col-span-2">
          <input type="checkbox" name="certified" required /> I certify the information on this form is true and correct.
        </label>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Date Signed</label>
          <input
            name="date_signed"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <Field label="Type your full name to sign" name="signature_name" required />
        {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
        >
          {submitting ? "Submitting…" : "Sign & Submit"}
        </button>
      </form>
    </div>
  );
}

// ── W-9 ──────────────────────────────────────────────────────────────────

const W9_CLASSIFICATIONS: { value: W9FormData["taxClassification"]; label: string }[] = [
  { value: "individual", label: "Individual / Sole Proprietor" },
  { value: "c_corp", label: "C Corporation" },
  { value: "s_corp", label: "S Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust/Estate" },
  { value: "llc", label: "LLC" },
  { value: "other", label: "Other" },
];

function W9SignForm({ doc, employeeName, onDone }: { doc: SignableDocument; employeeName: string; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const data: W9FormData = {
        ...EMPTY_W9,
        name: (form.get("name") as string) || employeeName,
        businessName: (form.get("business_name") as string) || "",
        taxClassification: form.get("tax_classification") as W9FormData["taxClassification"],
        llcTaxClassificationCode: (form.get("llc_code") as string) || "",
        otherClassificationText: (form.get("other_classification") as string) || "",
        address: form.get("address") as string,
        cityStateZip: form.get("city_state_zip") as string,
        ssnPart1: (form.get("ssn1") as string) || "",
        ssnPart2: (form.get("ssn2") as string) || "",
        ssnPart3: (form.get("ssn3") as string) || "",
        einPart1: (form.get("ein1") as string) || "",
        einPart2: (form.get("ein2") as string) || "",
        dateSigned: form.get("date_signed") as string,
        signatureName: form.get("signature_name") as string,
      };
      const bytes = await fillW9Pdf(data);
      const path = await uploadSignedPdf(doc.id, bytes, "w9.pdf");
      await signDocument(doc.id, employeeName, data.signatureName, path, data as unknown as Record<string, unknown>);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#1c2024]">Form W-9: Request for Taxpayer Identification Number</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={employeeName} required />
        <Field label="Business Name (if any)" name="business_name" />
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Federal Tax Classification</label>
          <select
            name="tax_classification"
            required
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {W9_CLASSIFICATIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <Field label="LLC Classification Code (if LLC)" name="llc_code" />
        <Field label="Other Classification (if Other)" name="other_classification" />
        <Field label="Address" name="address" required />
        <Field label="City, State, ZIP" name="city_state_zip" required />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-[#1c2024]">Social Security Number</p>
          <div className="flex gap-2">
            <input name="ssn1" maxLength={3} placeholder="XXX" className="w-20 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]" />
            <input name="ssn2" maxLength={2} placeholder="XX" className="w-16 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]" />
            <input name="ssn3" maxLength={4} placeholder="XXXX" className="w-20 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-[#1c2024]">Employer Identification Number</p>
          <div className="flex gap-2">
            <input name="ein1" maxLength={2} placeholder="XX" className="w-16 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]" />
            <input name="ein2" maxLength={7} placeholder="XXXXXXX" className="w-28 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Date Signed</label>
          <input
            name="date_signed"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <Field label="Type your full name to sign" name="signature_name" required />
        {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
        >
          {submitting ? "Submitting…" : "Sign & Submit"}
        </button>
      </form>
    </div>
  );
}
