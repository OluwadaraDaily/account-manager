import type { NormalizedTransaction } from "@account-manager/shared";

function normalizePart(value: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildTransactionFingerprint(transaction: NormalizedTransaction) {
  return [
    transaction.transactionDate,
    transaction.transactionTime,
    transaction.direction,
    transaction.amount,
    transaction.currency,
    transaction.counterparty,
    transaction.description,
    transaction.channel,
  ]
    .map(normalizePart)
    .join("|");
}
