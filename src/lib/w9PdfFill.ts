/**
 * Fills the real, official IRS Form W-9 PDF (src/assets/w9-blank.pdf) using
 * its own native AcroForm fields — adapted from a prior working
 * implementation. Field names are the generic `f1_NN`/`c1_N` the IRS's PDF
 * generator assigns, nested under grouping subforms.
 *
 * There is no AcroForm field for Part II's signature/date line — the IRS's
 * own form expects a handwritten signature there. Since this app captures a
 * typed-name e-signature rather than a drawn one, both are drawn as text
 * directly onto the page at the same coordinates a signature would occupy.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { W9FormData } from "./w9FormTemplate";

const P = (n: string) => `topmostSubform[0].Page1[0].${n}`;

const fmtDate = (v: string) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
};

export async function loadBlankW9Bytes(): Promise<Uint8Array> {
  const mod = await import("@/assets/w9-blank.pdf");
  const res = await fetch(mod.default);
  return new Uint8Array(await res.arrayBuffer());
}

export async function fillW9Pdf(data: W9FormData): Promise<Uint8Array> {
  const blankBytes = await loadBlankW9Bytes();
  const pdfDoc = await PDFDocument.load(blankBytes);
  const form = pdfDoc.getForm();

  const setText = (name: string, value: string) => {
    try {
      form.getTextField(P(name)).setText(value ?? "");
    } catch (err) {
      console.error(`W-9 PDF: failed to set field ${name}:`, err);
    }
  };
  const setCheck = (name: string, checked: boolean) => {
    try {
      const box = form.getCheckBox(P(name));
      if (checked) box.check();
      else box.uncheck();
    } catch (err) {
      console.error(`W-9 PDF: failed to set checkbox ${name}:`, err);
    }
  };

  setText("f1_01[0]", data.name);
  setText("f1_02[0]", data.businessName);

  setCheck("Boxes3a-b_ReadOrder[0].c1_1[0]", data.taxClassification === "individual");
  setCheck("Boxes3a-b_ReadOrder[0].c1_1[1]", data.taxClassification === "c_corp");
  setCheck("Boxes3a-b_ReadOrder[0].c1_1[2]", data.taxClassification === "s_corp");
  setCheck("Boxes3a-b_ReadOrder[0].c1_1[3]", data.taxClassification === "partnership");
  setCheck("Boxes3a-b_ReadOrder[0].c1_1[4]", data.taxClassification === "trust_estate");
  setCheck("Boxes3a-b_ReadOrder[0].c1_1[5]", data.taxClassification === "llc");
  setText("Boxes3a-b_ReadOrder[0].f1_03[0]", data.taxClassification === "llc" ? data.llcTaxClassificationCode : "");
  setCheck("Boxes3a-b_ReadOrder[0].c1_1[6]", data.taxClassification === "other");
  setText("Boxes3a-b_ReadOrder[0].f1_04[0]", data.taxClassification === "other" ? data.otherClassificationText : "");

  setCheck("Boxes3a-b_ReadOrder[0].c1_2[0]", data.foreignPartnersCheckbox);

  setText("f1_05[0]", data.exemptPayeeCode);
  setText("f1_06[0]", data.fatcaExemptionCode);

  setText("Address_ReadOrder[0].f1_07[0]", data.address);
  setText("Address_ReadOrder[0].f1_08[0]", data.cityStateZip);
  setText("f1_10[0]", data.accountNumbers);

  setText("f1_09[0]", data.requesterNameAddress);

  setText("f1_11[0]", data.ssnPart1);
  setText("f1_12[0]", data.ssnPart2);
  setText("f1_13[0]", data.ssnPart3);
  setText("f1_14[0]", data.einPart1);
  setText("f1_15[0]", data.einPart2);

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  form.updateFieldAppearances(helveticaBold);

  const page1 = pdfDoc.getPage(0);
  const dateStr = fmtDate(data.dateSigned);
  if (dateStr) {
    page1.drawText(dateStr, { x: 420, y: 198, size: 9, font: helveticaBold, color: rgb(0, 0, 0.545) });
  }
  if (data.signatureName) {
    page1.drawText(data.signatureName, { x: 160, y: 198, size: 10, font: helveticaBold, color: rgb(0, 0, 0.545) });
  }

  for (const field of form.getFields()) {
    field.enableReadOnly();
  }

  return pdfDoc.save();
}
