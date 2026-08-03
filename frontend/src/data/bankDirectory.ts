import bankDirectory from "../../../data/banks.json";

export const bankDirectoryEntries = bankDirectory.banks.filter(
  (bank) => bank.status !== "inactive",
);
