import assert from "node:assert/strict";
import test from "node:test";

const [{ createSqliteDatabase }, { initializeDatabase }, { SqliteGroupingStore }] = await Promise.all([
  import("../dist/db/sqlite.js"),
  import("../dist/db/schema.js"),
  import("../dist/db/repositories/groupingStore.js"),
]);

async function setup() {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  return { database, store: new SqliteGroupingStore(database, false) };
}

async function seedTransaction(database, id, user = "user-1", bank = "union-bank") {
  database
    .prepare(
      `INSERT INTO normalized_transactions
        (transaction_id, google_subject, bank_id, source_message_id, fingerprint,
         transaction_date, direction, amount, currency, counterparty, description, channel,
         confidence, review_reasons_json, review_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, user, bank, `message-${id}`, `fingerprint-${id}`, "2026-01-01", "debit", "100.00", "NGN", "Shop", "Order", "POS", "high", "[]", "ready", new Date().toISOString(), new Date().toISOString());
}

test("creates arbitrary groups, assigns transactions, and recalls counts across imports", async () => {
  const { database, store } = await setup();
  await seedTransaction(database, "transaction-1");
  await seedTransaction(database, "transaction-2");

  const group = await store.create({ googleSubject: "user-1", bankId: "union-bank", name: "  Weekend treats  " });
  assert.equal(group.name, "Weekend treats");
  assert.equal(group.transactionCount, 0);
  await store.assign("user-1", "union-bank", group.id, "transaction-1");
  await store.assign("user-1", "union-bank", group.id, "transaction-2");
  assert.equal((await store.list("user-1", "union-bank"))[0].transactionCount, 2);
  assert.equal((await store.listMemberships("user-1", "union-bank")).length, 2);

  database.close();
});

test("moving a transaction replaces its previous membership and unassigning returns it to Ungrouped", async () => {
  const { database, store } = await setup();
  await seedTransaction(database, "transaction-1");
  const first = await store.create({ googleSubject: "user-1", bankId: "union-bank", name: "Food" });
  const second = await store.create({ googleSubject: "user-1", bankId: "union-bank", name: "Bills" });
  await store.assign("user-1", "union-bank", first.id, "transaction-1");
  await store.assign("user-1", "union-bank", second.id, "transaction-1");
  assert.deepEqual((await store.listMemberships("user-1", "union-bank")).map((item) => item.groupId), [second.id]);
  assert.equal(await store.unassign("user-1", "union-bank", "transaction-1"), true);
  assert.equal((await store.listMemberships("user-1", "union-bank")).length, 0);
  database.close();
});

test("protects group names and ownership boundaries", async () => {
  const { database, store } = await setup();
  await seedTransaction(database, "transaction-1");
  const group = await store.create({ googleSubject: "user-1", bankId: "union-bank", name: "Groceries" });
  await assert.rejects(
    store.create({ googleSubject: "user-1", bankId: "union-bank", name: " groceries " }),
    /already exists/,
  );
  assert.equal(await store.assign("other-user", "union-bank", group.id, "transaction-1"), null);
  assert.equal(await store.delete("other-user", "union-bank", group.id), false);
  database.close();
});

test("deleting a group preserves transactions and removes memberships", async () => {
  const { database, store } = await setup();
  await seedTransaction(database, "transaction-1");
  const group = await store.create({ googleSubject: "user-1", bankId: "union-bank", name: "Keep transactions" });
  await store.assign("user-1", "union-bank", group.id, "transaction-1");
  assert.equal(await store.delete("user-1", "union-bank", group.id), true);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM normalized_transactions WHERE transaction_id = ?").get("transaction-1").count, 1);
  assert.equal((await store.listMemberships("user-1", "union-bank")).length, 0);
  database.close();
});
