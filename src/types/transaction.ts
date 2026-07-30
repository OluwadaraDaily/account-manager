export type TransactionType = "Debit" | "Credit";
export type TransactionStatus = "Matched" | "Review";

export type Transaction = {
  date: string;
  description: string;
  counterparty: string;
  type: TransactionType;
  amount: string;
  status: TransactionStatus;
};
