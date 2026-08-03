import assert from "node:assert/strict";
import test from "node:test";

const [{ createSqliteDatabase }, { initializeDatabase }, { SqliteBankDirectoryStore }] =
  await Promise.all([
    import("../dist/db/sqlite.js"),
    import("../dist/db/schema.js"),
    import("../dist/db/repositories/bankDirectoryStore.js"),
  ]);

test("preserves a saved sender when static bank metadata is seeded again", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteBankDirectoryStore(database, false);
  const seed = {
    id: "access-bank",
    displayName: "Access Bank",
    legalName: "Access Bank Limited",
    aliases: ["Access Bank"],
    licenceCategory: "commercial-international",
    officialDomains: ["accessbankplc.com"],
    customerServiceEmails: [],
    candidateContactEmails: [],
    transactionNotificationSenderEmail: null,
    searchTerms: ["access bank"],
    status: "needs-review",
    verificationStatus: "needs-review",
    sources: [],
    checkedAt: null,
  };

  await store.upsert(seed);
  await store.setTransactionNotificationSender("access-bank", "alerts@example.com");
  const seededAgain = await store.upsert(seed);

  assert.equal(seededAgain.transactionNotificationSenderEmail, "alerts@example.com");
  assert.equal((await store.list()).length, 1);
  database.close();
});
