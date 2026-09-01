import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseUnionBankTransaction } from "../dist/parsers/unionBankParser.js";

const fixtures = [
  ["debit", "debit"],
  ["credit", "credit"],
];

for (const [fixtureName, expectedDirection] of fixtures) {
  test("parses the redacted Union Bank " + fixtureName + " fixture", async () => {
    const body = await readFile(
      new URL("./fixtures/union-bank-" + fixtureName + "-redacted.txt", import.meta.url),
      "utf8",
    );

    const transaction = parseUnionBankTransaction({
      id: "fixture-" + fixtureName,
      threadId: "thread-" + fixtureName,
      internalDate: null,
      headers: {
        from: "alerts@unionbankng.com",
        subject: "Union Bank transaction alert",
        date: null,
      },
      body: {
        text: body,
        source: "plain",
      },
    });

    assert.ok(transaction);
    assert.deepEqual(
      {
        direction: transaction.direction,
        amount: transaction.amount,
        currency: transaction.currency,
        transactionDate: transaction.transactionDate,
        description: transaction.description,
        channel: transaction.channel,
        confidence: transaction.confidence,
        reviewReasons: transaction.reviewReasons,
        reviewStatus: transaction.reviewStatus,
      },
      {
        direction: expectedDirection,
        amount: "12345.67",
        currency: "NGN",
        transactionDate: "2026-02-01",
        description: "POS example transaction",
        channel: "POS",
        confidence: "high",
        reviewReasons: [],
        reviewStatus: "ready",
      },
    );
  });
}

test("skips an obvious non-transaction Union Bank fixture", async () => {
  const body = await readFile(
    new URL("./fixtures/union-bank-non-transaction-redacted.txt", import.meta.url),
    "utf8",
  );

  const transaction = parseUnionBankTransaction({
    id: "fixture-non-transaction",
    threadId: "thread-non-transaction",
    internalDate: null,
    headers: {
      from: "alerts@unionbankng.com",
      subject: "Union Bank transaction summary available",
      date: null,
    },
    body: {
      text: body,
      source: "plain",
    },
  });

  assert.equal(transaction, null);
});

test("extracts transaction time from a combined date and time field", () => {
  const transaction = parseUnionBankTransaction({
    id: "fixture-date-time",
    threadId: "thread-date-time",
    internalDate: null,
    headers: {
      from: "alerts@unionbankng.com",
      subject: "Union Bank transaction alert",
      date: null,
    },
    body: {
      text: `
        Transaction Type: DebitAlert
        Transaction Date & Time: 31/01/2026 14:35:22
        Transaction Amount: NGN 1,250.00
        Transaction Description: Date time example
      `,
      source: "plain",
    },
  });

  assert.ok(transaction);
  assert.equal(transaction.transactionDate, "2026-01-31");
  assert.equal(transaction.transactionTime, "14:35:22");
});

test("handles an incomplete Union Bank fixture without throwing", async () => {
  const body = await readFile(
    new URL("./fixtures/union-bank-incomplete-redacted.txt", import.meta.url),
    "utf8",
  );

  const transaction = parseUnionBankTransaction({
    id: "fixture-incomplete",
    threadId: "thread-incomplete",
    internalDate: String(Date.parse("2026-02-03T09:30:00.000Z")),
    headers: {
      from: "alerts@unionbankng.com",
      subject: "Union Bank transaction alert",
      date: null,
    },
    body: {
      text: body,
      source: "plain",
    },
  });

  assert.ok(transaction);
  assert.deepEqual(
    {
      direction: transaction.direction,
      amount: transaction.amount,
      currency: transaction.currency,
      transactionDate: transaction.transactionDate,
      counterparty: transaction.counterparty,
      channel: transaction.channel,
      confidence: transaction.confidence,
      reviewReasons: transaction.reviewReasons,
      reviewStatus: transaction.reviewStatus,
    },
    {
      direction: "debit",
      amount: null,
      currency: null,
      transactionDate: "2026-02-03",
      counterparty: null,
      channel: "ATM",
      confidence: "low",
      reviewReasons: ["amount_missing", "date_fallback_used"],
      reviewStatus: "needs-review",
    },
  );
});

test("parses a native plain-text Union Bank debit fixture", async () => {
  const body = await readFile(
    new URL("./fixtures/union-bank-debit-plain-redacted.txt", import.meta.url),
    "utf8",
  );

  const transaction = parseUnionBankTransaction({
    id: "fixture-debit-plain",
    threadId: "thread-debit-plain",
    internalDate: null,
    headers: {
      from: "alerts@unionbankng.com",
      subject: "Union Bank transaction alert",
      date: null,
    },
    body: {
      text: body,
      source: "plain",
    },
  });

  assert.ok(transaction);
  assert.deepEqual(
    {
      direction: transaction.direction,
      amount: transaction.amount,
      currency: transaction.currency,
      transactionDate: transaction.transactionDate,
      description: transaction.description,
      channel: transaction.channel,
      confidence: transaction.confidence,
      reviewReasons: transaction.reviewReasons,
      reviewStatus: transaction.reviewStatus,
    },
    {
      direction: "debit",
      amount: "2500.00",
      currency: "NGN",
      transactionDate: "2026-02-05",
      description: "Plain text example transaction",
      channel: "USSD",
      confidence: "high",
      reviewReasons: [],
      reviewStatus: "ready",
    },
  );
});

test("marks an explicit refund as needing review", async () => {
  const body = await readFile(
    new URL("./fixtures/union-bank-refund-redacted.txt", import.meta.url),
    "utf8",
  );

  const transaction = parseUnionBankTransaction({
    id: "fixture-refund",
    threadId: "thread-refund",
    internalDate: null,
    headers: {
      from: "alerts@unionbankng.com",
      subject: "Union Bank refund alert",
      date: null,
    },
    body: {
      text: body,
      source: "plain",
    },
  });

  assert.ok(transaction);
  assert.equal(transaction.confidence, "high");
  assert.deepEqual(transaction.reviewReasons, ["possible_reversal_or_refund"]);
  assert.equal(transaction.reviewStatus, "needs-review");
});
