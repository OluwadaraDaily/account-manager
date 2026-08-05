export type HealthResponse = {
  service: "account-manager-backend";
  status: "ok";
};

export type TransactionConfidence = "high" | "medium" | "low";

export type NormalizedTransaction = {
  sourceMessageId: string;
  transactionDate: string | null;
  direction: "debit" | "credit" | null;
  amount: string | null;
  currency: string | null;
  counterparty: string | null;
  description: string | null;
  channel: string | null;
  confidence: TransactionConfidence;
  reviewReasons: string[];
};
