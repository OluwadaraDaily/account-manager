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
      },
      {
        direction: expectedDirection,
        amount: "12345.67",
        currency: "NGN",
        transactionDate: "2026-02-01",
        description: "POS example transaction",
        channel: "POS",
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
