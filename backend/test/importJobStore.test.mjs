import assert from "node:assert/strict";
import test from "node:test";

const [{ createSqliteDatabase }, { initializeDatabase }, { SqliteImportJobStore }] =
  await Promise.all([
    import("../dist/db/sqlite.js"),
    import("../dist/db/schema.js"),
    import("../dist/db/repositories/importJobStore.js"),
  ]);

test("lists import jobs only for the requested user and bank", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteImportJobStore(database, false);

  const criteria = {
    bankId: "union-bank",
    searchMode: "sender",
    senderEmail: "alerts@example.com",
    after: 1769904000,
    before: 1772582400,
    subject: "Transaction alert",
    keyword: null,
  };
  const requestedUserJob = await store.create("google-subject", criteria);
  await store.create("other-user", criteria);
  await store.create("google-subject", { ...criteria, bankId: "other-bank" });

  const jobs = await store.list("google-subject", "union-bank");

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, requestedUserJob.id);
  assert.equal(jobs[0].googleSubject, "google-subject");
  database.close();
});
