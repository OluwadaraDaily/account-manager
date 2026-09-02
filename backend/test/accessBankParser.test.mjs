import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseAccessBankTransaction } from "../dist/parsers/access/parser.js";

const fixtures = [
  ["debit-one", "debit", "2900.00", "2025-06-30", "WEB"],
  ["debit-two", "debit", "3400.00", "2025-06-29", null],
  ["credit-one", "credit", "120000.00", "2025-06-01", null],
  ["credit-two", "credit", "100000.00", "2025-05-05", "MOBILE"],
];

for (const [fixtureName, direction, amount, transactionDate, channel] of fixtures) {
  test("parses the redacted Access Bank " + fixtureName + " fixture", async () => {
    const body = await readFile(
      new URL("./fixtures/access-bank-" + fixtureName + "-redacted.txt", import.meta.url),
      "utf8",
    );
    const transaction = parseAccessBankTransaction({
      id: "fixture-" + fixtureName,
      threadId: "thread-" + fixtureName,
      internalDate: null,
      headers: {
        from: '"no_reply@accessbankplc.com" <no_reply@accessbankplc.com>',
        subject:
          "AccessAlert Transaction Alert [" +
          (direction === "debit" ? "Debit" : "Credit") +
          ": " +
          amount +
          " NGN]",
        date: null,
      },
      body: { text: body, source: "plain" },
    });

    assert.ok(transaction);
    assert.equal(transaction.direction, direction);
    assert.equal(transaction.amount, amount);
    assert.equal(transaction.currency, "NGN");
    assert.equal(transaction.transactionDate, transactionDate);
    assert.equal(transaction.transactionTime, null);
    assert.equal(transaction.channel, channel);
    assert.equal(transaction.confidence, "high");
    const expectedReviewReasons =
      fixtureName === "credit-one" ? ["possible_reversal_or_refund"] : [];
    assert.deepEqual(transaction.reviewReasons, expectedReviewReasons);
    assert.equal(transaction.reviewStatus, expectedReviewReasons.length ? "needs-review" : "ready");
  });
}

test("rejects a non-Access sender", () => {
  assert.equal(
    parseAccessBankTransaction({
      id: "fixture-wrong-sender",
      threadId: "thread-wrong-sender",
      internalDate: null,
      headers: { from: "alerts@example.com", subject: "AccessAlert Credit", date: null },
      body: { text: "Your account has been Credited\nNGN 1,000.00", source: "plain" },
    }),
    null,
  );
});
