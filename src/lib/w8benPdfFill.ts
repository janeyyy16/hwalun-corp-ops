/**
 * Fills the real, official IRS Form W-8BEN PDF (src/assets/w8ben-blank.pdf)
 * using its own native AcroForm fields — adapted from a prior working
 * implementation. Field names are the generic `f_1`..`f_21` the IRS's PDF
 * generator assigns under topmostSubform[0].Page1[0].*.
 *
 * f_20 (Part III's signature line) is a PDFSignature field, not a normal
 * text field — pdf-lib can't fill that directly, so the typed-name
 * e-signature is drawn as text onto the page at that field's own rectangle
 * instead, same as the rest of this app's signature handling.
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { W8benFormData } from "./w8benFormTemplate";

const F = (n: string) => `topmostSubform[0].Page1[0].${n}`;

const fmtDate = (v: string) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
};

export async function loadBlankW8benBytes(): Promise<Uint8Array> {
  const mod = await import("@/assets/w8ben-blank.pdf");
  const res = await fetch(mod.default);
  return new Uint8Array(await res.arrayBuffer());
}

export async function fillW8benPdf(data: W8benFormData): Promise<Uint8Array> {
  const blankBytes = await loadBlankW8benBytes();
  const pdfDoc = await PDFDocument.load(blankBytes);
  const form = pdfDoc.getForm();

  const setText = (name: string, value: string) => {
    try {
      form.getTextField(F(name)).setText(value ?? "");
    } catch (err) {
      console.error(`W-8BEN PDF: failed to set field ${name}:`, err);
    }
  };
  const setCheck = (name: string, checked: boolean) => {
    try {
      const box = form.getCheckBox(F(name));
      if (checked) box.check();
      else box.uncheck();
    } catch (err) {
      console.error(`W-8BEN PDF: failed to set checkbox ${name}:`, err);
    }
  };

  setText("f_1[0]", data.employeeName);
  setText("f_2[0]", data.countryOfCitizenship);
  setText("f_3[0]", data.permanentAddress.street);
  setText("f_4[0]", data.permanentAddress.cityStateZip);
  setText("f_5[0]", data.permanentAddress.country);
  setText("f_6[0]", data.mailingAddress.street);
  setText("f_7[0]", data.mailingAddress.cityStateZip);
  setText("f_8[0]", data.mailingAddress.country);
  setText("f_9[0]", data.usTin);
  setCheck("c1_01[0]", data.ftinNotRequired);
  setText("f_10[0]", data.ftin);
  setText("f_11[0]", data.referenceNumbers);
  setText("f_12[0]", fmtDate(data.dateOfBirth));

  setText("f_13[0]", data.treatyResidentCountry);
  setText("f_14[0]", data.treatyArticleParagraph);
  setText("f_15[0]", data.treatyRate);
  setText("f_16[0]", data.treatyIncomeType);
  setText("f_18[0]", data.treatyAdditionalConditions);
  // Every field needs setText("") at least once even when left blank — an
  // untouched field has no appearance stream, and updateFieldAppearances()
  // throws the moment it reaches one.
  setText("f_17[0]", "");

  setCheck("c1_02[0]", data.certifiedTrue);
  setText("Date[0]", fmtDate(data.dateSigned));
  setText("f_21[0]", data.employeeName);

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  form.updateFieldAppearances(helveticaBold);

  if (data.signatureName) {
    const sigField = form.getField(F("f_20[0]"));
    const rect = sigField.acroField.getWidgets()[0].getRectangle();
    const page = pdfDoc.getPage(0);
    page.drawText(data.signatureName, { x: rect.x + 2, y: rect.y + 4, size: 10, font: helveticaBold });
  }

  for (const field of form.getFields()) {
    field.enableReadOnly();
  }

  return pdfDoc.save();
}
