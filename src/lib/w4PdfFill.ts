/**
 * Fills the real, official IRS Form W-4 PDF (src/assets/w4-blank.pdf) using
 * its own native AcroForm fields. Field names are the generic `f1_NN`/`c1_N`
 * the IRS's PDF generator assigns, nested under grouping subforms — adapted
 * from a prior working implementation that derived this mapping by
 * inspecting each field's on-page position against the visible line labels.
 *
 * Only Page 1 (the submittable certificate) is filled — the Multiple Jobs
 * and Deductions worksheets (pages 3/4) are optional per the IRS's own
 * instructions and are left blank in this simplified version.
 *
 * There is no AcroForm field for Step 5's signature/date line — the IRS's
 * own form expects a handwritten signature there. Since this app captures a
 * typed-name e-signature rather than a drawn one, both are drawn as text
 * directly onto the page at the same coordinates a signature would occupy.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { W4FormData } from "./w4FormTemplate";

const P = (n: string) => `topmostSubform[0].Page1[0].${n}`;

const fmtDate = (v: string) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
};

export async function loadBlankW4Bytes(): Promise<Uint8Array> {
  const mod = await import("@/assets/w4-blank.pdf");
  const res = await fetch(mod.default);
  return new Uint8Array(await res.arrayBuffer());
}

export async function fillW4Pdf(data: W4FormData): Promise<Uint8Array> {
  const blankBytes = await loadBlankW4Bytes();
  const pdfDoc = await PDFDocument.load(blankBytes);
  const form = pdfDoc.getForm();

  const setText = (name: string, value: string) => {
    try {
      form.getTextField(name).setText(value ?? "");
    } catch (err) {
      console.error(`W-4 PDF: failed to set field ${name}:`, err);
    }
  };
  const setCheck = (name: string, checked: boolean) => {
    try {
      const box = form.getCheckBox(name);
      if (checked) box.check();
      else box.uncheck();
    } catch (err) {
      console.error(`W-4 PDF: failed to set checkbox ${name}:`, err);
    }
  };

  setText(P("Step1a[0].f1_01[0]"), data.firstNameMiddleInitial);
  setText(P("Step1a[0].f1_02[0]"), data.lastName);
  setText(P("f1_05[0]"), data.ssn);
  setText(P("Step1a[0].f1_03[0]"), data.address);
  setText(P("Step1a[0].f1_04[0]"), data.cityStateZip);

  setCheck(P("c1_1[0]"), data.filingStatus === "single_or_mfs");
  setCheck(P("c1_1[1]"), data.filingStatus === "married_filing_jointly");
  setCheck(P("c1_1[2]"), data.filingStatus === "head_of_household");

  setCheck(P("c1_2[0]"), data.multipleJobsCheckbox);

  setText(P("Step3_ReadOrder[0].f1_06[0]"), data.step3ChildrenAmount);
  setText(P("Step3_ReadOrder[0].f1_07[0]"), data.step3OtherDependentsAmount);
  setText(P("f1_08[0]"), data.step3TotalAmount);

  setText(P("f1_09[0]"), data.step4aOtherIncome);
  setText(P("f1_10[0]"), data.step4bDeductions);
  setText(P("f1_11[0]"), data.step4cExtraWithholding);

  setCheck(P("c1_3[0]"), data.exemptCheckbox);

  setText(P("f1_12[0]"), data.employerNameAndAddress);
  setText(P("f1_13[0]"), fmtDate(data.employerFirstDateOfEmployment));
  setText(P("f1_14[0]"), data.employerEin);

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  form.updateFieldAppearances(helveticaBold);

  const page1 = pdfDoc.getPage(0);
  const dateStr = fmtDate(data.dateSigned);
  if (dateStr) {
    page1.drawText(dateStr, { x: 465, y: 93, size: 9, font: helveticaBold, color: rgb(0, 0, 0.545) });
  }
  if (data.signatureName) {
    page1.drawText(data.signatureName, { x: 100, y: 93, size: 11, font: helveticaBold, color: rgb(0, 0, 0.545) });
  }

  for (const field of form.getFields()) {
    field.enableReadOnly();
  }

  return pdfDoc.save();
}
