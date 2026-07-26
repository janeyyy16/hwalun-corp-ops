export type W4FilingStatus = "single_or_mfs" | "married_filing_jointly" | "head_of_household" | "";

export interface W4FormData {
  firstNameMiddleInitial: string;
  lastName: string;
  ssn: string;
  address: string;
  cityStateZip: string;
  filingStatus: W4FilingStatus;
  multipleJobsCheckbox: boolean;
  step3ChildrenAmount: string;
  step3OtherDependentsAmount: string;
  step3TotalAmount: string;
  step4aOtherIncome: string;
  step4bDeductions: string;
  step4cExtraWithholding: string;
  exemptCheckbox: boolean;
  dateSigned: string;
  signatureName: string;
  // "Employers Only" box — blank at submission, filled in afterward by HR.
  employerNameAndAddress: string;
  employerFirstDateOfEmployment: string;
  employerEin: string;
}

export const EMPTY_W4: W4FormData = {
  firstNameMiddleInitial: "",
  lastName: "",
  ssn: "",
  address: "",
  cityStateZip: "",
  filingStatus: "",
  multipleJobsCheckbox: false,
  step3ChildrenAmount: "",
  step3OtherDependentsAmount: "",
  step3TotalAmount: "",
  step4aOtherIncome: "",
  step4bDeductions: "",
  step4cExtraWithholding: "",
  exemptCheckbox: false,
  dateSigned: "",
  signatureName: "",
  employerNameAndAddress: "",
  employerFirstDateOfEmployment: "",
  employerEin: "",
};
