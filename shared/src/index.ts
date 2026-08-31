export type HealthResponse = {
  service: "account-manager-backend";
  status: "ok";
};

export type TransactionConfidence = "high" | "medium" | "low";
export type TransactionReviewStatus = "ready" | "needs-review" | "dismissed";

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
  reviewStatus: TransactionReviewStatus;
};

export type TransactionGroup = {
  id: string;
  name: string;
  googleSubject: string;
  bankId: string;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TransactionGroupResponse = Omit<TransactionGroup, "googleSubject" | "bankId">;

export type TransactionGroupMembership = {
  transactionId: string;
  groupId: string;
  googleSubject: string;
  bankId: string;
  assignmentSource: "manual";
  createdAt: string;
  updatedAt: string;
};

export type TransactionGroupMembershipResponse = Omit<
  TransactionGroupMembership,
  "googleSubject" | "bankId"
>;
