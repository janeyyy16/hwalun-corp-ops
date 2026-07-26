export type W9TaxClassification =
  | "individual"
  | "c_corp"
  | "s_corp"
  | "partnership"
  | "trust_estate"
  | "llc"
  | "other"
  | "";

export interface W9FormData {
  name: string;
  businessName: string;
  taxClassification: W9TaxClassification;
  llcTaxClassificationCode: string;
  otherClassificationText: string;
  foreignPartnersCheckbox: boolean;
  exemptPayeeCode: string;
  fatcaExemptionCode: string;
  address: string;
  cityStateZip: string;
  accountNumbers: string;
  requesterNameAddress: string;
  ssnPart1: string;
  ssnPart2: string;
  ssnPart3: string;
  einPart1: string;
  einPart2: string;
  dateSigned: string;
  signatureName: string;
}

export const EMPTY_W9: W9FormData = {
  name: "",
  businessName: "",
  taxClassification: "",
  llcTaxClassificationCode: "",
  otherClassificationText: "",
  foreignPartnersCheckbox: false,
  exemptPayeeCode: "",
  fatcaExemptionCode: "",
  address: "",
  cityStateZip: "",
  accountNumbers: "",
  requesterNameAddress: "",
  ssnPart1: "",
  ssnPart2: "",
  ssnPart3: "",
  einPart1: "",
  einPart2: "",
  dateSigned: "",
  signatureName: "",
};
