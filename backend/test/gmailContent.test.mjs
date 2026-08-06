import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractGmailBodyText } from "../dist/integrations/google/gmailContent.js";
import { parseUnionBankTransaction } from "../dist/parsers/unionBankParser.js";

test("extracts and parses a redacted Union Bank HTML fixture", async () => {
  const html = await readFile(
    new URL("./fixtures/union-bank-credit-html-redacted.html", import.meta.url),
    "utf8",
  );
  const body = extractGmailBodyText({
    mimeType: "multipart/alternative",
    parts: [
      {
        mimeType: "text/html",
        body: { data: Buffer.from(html).toString("base64url") },
      },
    ],
  });

  assert.equal(body.source, "html");
  assert.ok(body.text);

  const transaction = parseUnionBankTransaction({
    id: "fixture-credit-html",
    threadId: "thread-credit-html",
    internalDate: null,
    headers: {
      from: "alerts@unionbankng.com",
      subject: "Union Bank transaction alert",
      date: null,
    },
    body,
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
      direction: "credit",
      amount: "3750.00",
      currency: "NGN",
      transactionDate: "2026-02-06",
      description: "HTML example transaction",
      channel: "POS",
      confidence: "high",
      reviewReasons: [],
      reviewStatus: "ready",
    },
  );
});

test("extracts and parses a redacted Union Bank HTML debit fixture", async () => {
  const html = await readFile(
    new URL("./fixtures/union-bank-debit-html-redacted.html", import.meta.url),
    "utf8",
  );
  const body = extractGmailBodyText({
    mimeType: "multipart/alternative",
    parts: [
      {
        mimeType: "text/html",
        body: { data: Buffer.from(html).toString("base64url") },
      },
    ],
  });

  assert.equal(body.source, "html");
  assert.ok(body.text);

  const transaction = parseUnionBankTransaction({
    id: "fixture-debit-html",
    threadId: "thread-debit-html",
    internalDate: null,
    headers: {
      from: "alerts@unionbankng.com",
      subject: "Union Bank transaction alert",
      date: null,
    },
    body,
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
      amount: "1250.00",
      currency: "NGN",
      transactionDate: "2026-02-07",
      description: "HTML debit example transaction",
      channel: "ATM",
      confidence: "high",
      reviewReasons: [],
      reviewStatus: "ready",
    },
  );
});
