import assert from "node:assert/strict";
import test from "node:test";

const [{ toTransactionResponse }] = await Promise.all([import("../dist/routes/importRoutes.js")]);

test("returns review metadata without account identity or raw Gmail content", () => {
  const response = toTransactionResponse({
    id: "transaction-1",
    googleSubject: "google-subject",
    bankId: "union-bank",
    sourceMessageId: "message-1",
    transactionDate: "2026-02-01",
    direction: "debit",
    amount: "12345.67",
    currency: "NGN",
    counterparty: "Example Merchant",
    description: "POS example transaction",
    channel: "POS",
    confidence: "high",
    reviewReasons: [],
    reviewStatus: "ready",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });

  assert.deepEqual(response, {
    id: "transaction-1",
    sourceMessageId: "message-1",
    transactionDate: "2026-02-01",
    direction: "debit",
    amount: "12345.67",
    currency: "NGN",
    counterparty: "Example Merchant",
    description: "POS example transaction",
    channel: "POS",
    confidence: "high",
    reviewReasons: [],
    reviewStatus: "ready",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });
});
