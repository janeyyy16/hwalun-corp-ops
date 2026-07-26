export interface W8benAddress {
  street: string;
  cityStateZip: string;
  country: string;
}

export interface W8benFormData {
  employeeName: string;
  countryOfCitizenship: string;
  permanentAddress: W8benAddress;
  mailingAddress: W8benAddress;
  usTin: string;
  ftinNotRequired: boolean;
  ftin: string;
  referenceNumbers: string;
  dateOfBirth: string;
  treatyResidentCountry: string;
  treatyArticleParagraph: string;
  treatyRate: string;
  treatyIncomeType: string;
  treatyAdditionalConditions: string;
  certifiedTrue: boolean;
  dateSigned: string;
  signatureName: string;
}

export const EMPTY_W8BEN: W8benFormData = {
  employeeName: "",
  countryOfCitizenship: "",
  permanentAddress: { street: "", cityStateZip: "", country: "" },
  mailingAddress: { street: "", cityStateZip: "", country: "" },
  usTin: "",
  ftinNotRequired: false,
  ftin: "",
  referenceNumbers: "",
  dateOfBirth: "",
  treatyResidentCountry: "",
  treatyArticleParagraph: "",
  treatyRate: "",
  treatyIncomeType: "",
  treatyAdditionalConditions: "",
  certifiedTrue: false,
  dateSigned: "",
  signatureName: "",
};
