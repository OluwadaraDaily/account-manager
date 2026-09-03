import assert from "node:assert/strict";
import test from "node:test";

const [
  { createSqliteDatabase },
  { initializeDatabase },
  { SqliteTransactionStore },
  { buildTransactionFingerprint },
] = await Promise.all([
  import("../dist/db/sqlite.js"),
  import("../dist/db/schema.js"),
  import("../dist/db/repositories/transactionStore.js"),
  import("../dist/import/transactionFingerprint.js"),
]);

test("stores normalized fields and updates an existing Gmail message idempotently", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteTransactionStore(database, false);
  const input = {
    googleSubject: "google-subject",
    bankId: "union-bank",
    transaction: {
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
    },
  };

  const inserted = await store.upsert(input);
  const updated = await store.upsert({
    ...input,
    transaction: { ...input.transaction, amount: "20000.00" },
  });

  assert.equal(updated.id, inserted.id);
  assert.equal(updated.amount, "20000.00");
  assert.equal(updated.confidence, "high");
  assert.deepEqual(updated.reviewReasons, []);
  assert.equal(updated.reviewStatus, "ready");
  assert.equal((await store.list("google-subject", "union-bank")).length, 1);
  assert.equal(await store.get("google-subject", "other-bank", "message-1"), null);
  const fingerprint = buildTransactionFingerprint({ ...input.transaction, amount: "20000.00" });
  assert.equal(
    (await store.findByFingerprint("google-subject", "union-bank", fingerprint))?.id,
    inserted.id,
  );
  assert.equal(
    await store.findByFingerprint(
      "google-subject",
      "union-bank",
      buildTransactionFingerprint({ ...input.transaction, amount: "different" }),
    ),
    null,
  );
  const directionUpdated = await store.update("google-subject", "union-bank", inserted.id, {
    direction: "credit",
    transactionDate: "2026-02-02",
    amount: "543.21",
    counterparty: "Updated Merchant",
    description: "Updated description",
    reviewStatus: "dismissed",
  });
  assert.equal(directionUpdated?.id, inserted.id);
  assert.equal(directionUpdated?.direction, "credit");
  assert.equal(directionUpdated?.transactionDate, "2026-02-02");
  assert.equal(directionUpdated?.amount, "543.21");
  assert.equal(directionUpdated?.counterparty, "Updated Merchant");
  assert.equal(directionUpdated?.description, "Updated description");
  assert.equal(directionUpdated?.reviewStatus, "dismissed");
  const page = await store.listPage("google-subject", "union-bank", { page: 1, pageSize: 1 });
  assert.equal(page.total, 1);
  assert.equal(page.transactions.length, 1);
  assert.deepEqual(page.reviewCounts, { ready: 0, needsReview: 0, dismissed: 1 });
  assert.deepEqual(await store.listPage("google-subject", "union-bank", { page: 2, pageSize: 1 }), {
    transactions: [],
    total: 1,
    reviewCounts: { ready: 0, needsReview: 0, dismissed: 1 },
  });
  assert.equal(
    (
      await store.findByFingerprint(
        "google-subject",
        "union-bank",
        buildTransactionFingerprint({
          ...input.transaction,
          transactionDate: "2026-02-02",
          amount: "543.21",
          direction: "credit",
          counterparty: "Updated Merchant",
          description: "Updated description",
        }),
      )
    )?.id,
    inserted.id,
  );
  assert.equal(
    await store.update("google-subject", "other-bank", inserted.id, { direction: "debit" }),
    null,
  );
  assert.equal(
    await store.update("other-user", "union-bank", inserted.id, { direction: "debit" }),
    null,
  );
  assert.deepEqual(await store.list("other-user", "union-bank"), []);
  assert.deepEqual(Object.keys(updated).sort(), [
    "amount",
    "bankId",
    "channel",
    "confidence",
    "counterparty",
    "createdAt",
    "currency",
    "description",
    "direction",
    "googleSubject",
    "id",
    "reviewReasons",
    "reviewStatus",
    "sourceMessageId",
    "transactionDate",
    "transactionTime",
    "updatedAt",
  ]);

  database.close();
});

test("requires account, bank, and source message identifiers", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteTransactionStore(database, false);
  const transaction = {
    sourceMessageId: "message-1",
    transactionDate: null,
    direction: null,
    amount: null,
    currency: null,
    counterparty: null,
    description: null,
    channel: null,
    confidence: "low",
    reviewReasons: ["amount_missing"],
    reviewStatus: "needs-review",
  };

  await assert.rejects(
    store.upsert({ googleSubject: "", bankId: "union-bank", transaction }),
    /googleSubject must not be empty/,
  );
  await assert.rejects(
    store.upsert({ googleSubject: "google-subject", bankId: "", transaction }),
    /bankId must not be empty/,
  );
  await assert.rejects(
    store.upsert({
      googleSubject: "google-subject",
      bankId: "union-bank",
      transaction: { ...transaction, sourceMessageId: "" },
    }),
    /sourceMessageId must not be empty/,
  );

  database.close();
});
