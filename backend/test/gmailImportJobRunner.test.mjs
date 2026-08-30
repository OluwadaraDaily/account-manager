import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const [{ createGmailImportJobRunner }, { encryptToken }] = await Promise.all([
  import("../dist/import/gmailImportJobRunner.js"),
  import("../dist/security/encryption.js"),
]);
const duplicateFixture = await readFile(
  new URL("./fixtures/union-bank-duplicate-redacted.txt", import.meta.url),
  "utf8",
);

test("processes Gmail messages sequentially and updates extraction progress", async () => {
  const job = {
    id: "job-1",
    googleSubject: "google-subject",
    status: "queued",
    criteria: {
      bankId: "union-bank",
      searchMode: "sender",
      senderEmail: "alerts@unionbankng.com",
      after: null,
      before: null,
      subject: null,
      keyword: null,
    },
    pageToken: null,
    progress: {
      messagesDiscovered: 0,
      messagesProcessed: 0,
      transactionsExtracted: 0,
      messagesSkipped: 0,
    },
    errorMessage: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
  };
  const updates = [];
  const messageIds = [];
  const savedSenders = [];
  const savedTransactions = [];
  const linkedTransactions = [];

  const runner = createGmailImportJobRunner({
    importJobStorePromise: Promise.resolve({
      async get() {
        return job;
      },
      async claim() {
        return job;
      },
      async update(_jobId, _googleSubject, changes) {
        updates.push(changes);
        return job;
      },
    }),
    bankDirectoryStorePromise: Promise.resolve({
      async get() {
        return {
          id: "union-bank",
          status: "active",
          verificationStatus: "verified",
          officialDomains: ["unionbankng.com"],
          transactionNotificationSenderEmail: "alerts@unionbankng.com",
        };
      },
      async setTransactionNotificationSender(bankId, senderEmail) {
        savedSenders.push({ bankId, senderEmail });
        return { id: bankId };
      },
    }),
    refreshTokenStorePromise: Promise.resolve({
      async get() {
        return encryptToken("refresh-token");
      },
    }),
    importJobTransactionStorePromise: Promise.resolve({
      async link(googleSubject, bankId, jobId, transactionId) {
        linkedTransactions.push({ googleSubject, bankId, jobId, transactionId });
      },
    }),
    transactionStorePromise: Promise.resolve({
      async findByFingerprint() {
        return savedTransactions.length > 0
          ? { id: "transaction-1", sourceMessageId: "transaction-message" }
          : null;
      },
      async upsert(input) {
        savedTransactions.push(input);
        return { id: "transaction-1", ...input.transaction };
      },
    }),
    async listMessages() {
      return {
        messages: [
          { id: "transaction-message", threadId: "thread-1" },
          { id: "duplicate-message", threadId: "thread-duplicate" },
          { id: "skipped-message", threadId: "thread-2" },
        ],
      };
    },
    async getMessageContent({ messageId }) {
      messageIds.push(messageId);

      if (messageId === "transaction-message" || messageId === "duplicate-message") {
        return {
          id: messageId,
          threadId: "thread-1",
          internalDate: null,
          headers: {
            from: "alerts@unionbankng.com",
            subject: "Union Bank transaction alert",
            date: null,
          },
          body: {
            source: "plain",
            text: duplicateFixture,
          },
        };
      }

      return {
        id: messageId,
        threadId: "thread-2",
        internalDate: null,
        headers: {
          from: "alerts@otherbank.example",
          subject: "Union Bank transaction alert",
          date: null,
        },
        body: {
          source: "plain",
          text: "Transaction Date: 02/02/2026\nDebit Amount: NGN 999.00",
        },
      };
    },
  });

  await runner("job-1", "google-subject");

  assert.deepEqual(messageIds, ["transaction-message", "duplicate-message", "skipped-message"]);
  assert.deepEqual(savedSenders, [{ bankId: "union-bank", senderEmail: "alerts@unionbankng.com" }]);
  assert.deepEqual(savedTransactions, [
    {
      googleSubject: "google-subject",
      bankId: "union-bank",
      transaction: {
        sourceMessageId: "transaction-message",
        transactionDate: "2026-02-01",
        direction: "debit",
        amount: "123.45",
        currency: "NGN",
        counterparty: null,
        description: "Union Bank transaction alert",
        channel: null,
        confidence: "high",
        reviewReasons: [],
        reviewStatus: "ready",
      },
    },
  ]);
  assert.deepEqual(linkedTransactions, [
    {
      googleSubject: "google-subject",
      bankId: "union-bank",
      jobId: "job-1",
      transactionId: "transaction-1",
    },
    {
      googleSubject: "google-subject",
      bankId: "union-bank",
      jobId: "job-1",
      transactionId: "transaction-1",
    },
  ]);
  const progressUpdate = updates.at(-2);
  assert.equal(progressUpdate.messagesDiscovered, 3);
  assert.equal(progressUpdate.messagesProcessed, 3);
  assert.equal(progressUpdate.transactionsExtracted, 1);
  assert.equal(progressUpdate.messagesSkipped, 2);

  const finalUpdate = updates.at(-1);
  assert.equal(finalUpdate.status, "completed");
  assert.equal(finalUpdate.pageToken, null);
});

test("fails before reading Gmail when the import has no selected bank", async () => {
  const job = {
    id: "job-without-bank",
    googleSubject: "google-subject",
    status: "queued",
    criteria: {
      bankId: null,
      searchMode: "sender",
      senderEmail: "alerts@unionbankng.com",
      after: null,
      before: null,
      subject: null,
      keyword: null,
    },
    pageToken: null,
    progress: {
      messagesDiscovered: 0,
      messagesProcessed: 0,
      transactionsExtracted: 0,
      messagesSkipped: 0,
    },
    errorMessage: null,
  };
  const updates = [];
  let messagesListed = false;

  const runner = createGmailImportJobRunner({
    importJobStorePromise: Promise.resolve({
      async get() {
        return job;
      },
      async claim() {
        return job;
      },
      async update(_jobId, _googleSubject, changes) {
        updates.push(changes);
        return job;
      },
    }),
    refreshTokenStorePromise: Promise.resolve({
      async get() {
        return encryptToken("refresh-token");
      },
    }),
    bankDirectoryStorePromise: Promise.resolve({
      async get() {
        return null;
      },
    }),
    importJobTransactionStorePromise: Promise.resolve({
      async link() {},
    }),
    transactionStorePromise: Promise.resolve({
      async upsert() {
        throw new Error("Transactions must not be persisted without a selected bank.");
      },
    }),
    async listMessages() {
      messagesListed = true;
      return { messages: [] };
    },
  });

  await runner("job-without-bank", "google-subject");

  assert.equal(messagesListed, false);
  assert.equal(updates.at(-1).status, "failed");
});
