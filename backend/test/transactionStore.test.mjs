import assert from "node:assert/strict";
import test from "node:test";

const [{ createSqliteDatabase }, { initializeDatabase }, { SqliteTransactionStore }] =
  await Promise.all([
    import("../dist/db/sqlite.js"),
    import("../dist/db/schema.js"),
    import("../dist/db/repositories/transactionStore.js"),
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
    },
  };

  const inserted = await store.upsert(input);
  const updated = await store.upsert({
    ...input,
    transaction: { ...input.transaction, amount: "20000.00" },
  });

  assert.equal(updated.id, inserted.id);
  assert.equal(updated.amount, "20000.00");
  assert.equal((await store.list("google-subject", "union-bank")).length, 1);
  assert.equal(await store.get("google-subject", "other-bank", "message-1"), null);
  assert.deepEqual(Object.keys(updated).sort(), [
    "amount",
    "bankId",
    "channel",
    "counterparty",
    "createdAt",
    "currency",
    "description",
    "direction",
    "googleSubject",
    "id",
    "sourceMessageId",
    "transactionDate",
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
