import assert from "node:assert/strict";
import test from "node:test";

const [
  { createSqliteDatabase },
  { initializeDatabase },
  { SqliteImportJobStore },
  { SqliteImportJobTransactionStore },
  { SqliteTransactionStore },
] = await Promise.all([
  import("../dist/db/sqlite.js"),
  import("../dist/db/schema.js"),
  import("../dist/db/repositories/importJobStore.js"),
  import("../dist/db/repositories/importJobTransactionStore.js"),
  import("../dist/db/repositories/transactionStore.js"),
]);

test("links each import job to its normalized transactions idempotently and scopes reads", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const jobs = new SqliteImportJobStore(database, false);
  const transactions = new SqliteTransactionStore(database, false);
  const links = new SqliteImportJobTransactionStore(database, false);
  const job = await jobs.create("google-subject", {
    bankId: "union-bank",
    searchMode: "sender",
    senderEmail: "alerts@example.com",
    after: null,
    before: null,
    subject: null,
    keyword: null,
  });
  const transaction = await transactions.upsert({
    googleSubject: "google-subject",
    bankId: "union-bank",
    transaction: {
      sourceMessageId: "message-1",
      transactionDate: "2026-02-01",
      direction: "debit",
      amount: "123.45",
      currency: "NGN",
      counterparty: "Example Merchant",
      description: "Example transaction",
      channel: "POS",
      confidence: "high",
      reviewReasons: [],
      reviewStatus: "ready",
    },
  });

  await links.link("google-subject", "union-bank", job.id, transaction.id);
  await links.link("google-subject", "union-bank", job.id, transaction.id);

  assert.deepEqual(await links.listTransactionIds("google-subject", "union-bank", job.id), [
    transaction.id,
  ]);
  assert.deepEqual(
    (await transactions.listForImportJob("google-subject", "union-bank", job.id)).map(
      (item) => item.id,
    ),
    [transaction.id],
  );
  assert.deepEqual(await links.listTransactionIds("other-user", "union-bank", job.id), []);
  assert.deepEqual(await links.listTransactionIds("google-subject", "other-bank", job.id), []);
  database.close();
});

test("reopening an import returns persisted transaction edits and dismissal status", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const jobs = new SqliteImportJobStore(database, false);
  const transactions = new SqliteTransactionStore(database, false);
  const links = new SqliteImportJobTransactionStore(database, false);
  const job = await jobs.create("google-subject", {
    bankId: "union-bank",
    searchMode: "sender",
    senderEmail: "alerts@example.com",
    after: null,
    before: null,
    subject: null,
    keyword: null,
  });
  const transaction = await transactions.upsert({
    googleSubject: "google-subject",
    bankId: "union-bank",
    transaction: {
      sourceMessageId: "message-1",
      transactionDate: "2026-02-01",
      direction: "debit",
      amount: "123.45",
      currency: "NGN",
      counterparty: "Example Merchant",
      description: "Example transaction",
      channel: "POS",
      confidence: "high",
      reviewReasons: [],
      reviewStatus: "ready",
    },
  });

  await links.link("google-subject", "union-bank", job.id, transaction.id);
  await transactions.update("google-subject", "union-bank", transaction.id, {
    counterparty: "Updated Merchant",
    description: "Updated description",
    reviewStatus: "dismissed",
  });

  const reopenedTransactions = await transactions.listForImportJob(
    "google-subject",
    "union-bank",
    job.id,
  );

  assert.equal(reopenedTransactions.length, 1);
  assert.equal(reopenedTransactions[0].id, transaction.id);
  assert.equal(reopenedTransactions[0].counterparty, "Updated Merchant");
  assert.equal(reopenedTransactions[0].description, "Updated description");
  assert.equal(reopenedTransactions[0].reviewStatus, "dismissed");
  assert.deepEqual(await links.listTransactionIds("google-subject", "union-bank", job.id), [
    transaction.id,
  ]);
  database.close();
});
