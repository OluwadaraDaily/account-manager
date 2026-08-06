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
  await store.create("google-subject", criteria);
  await store.create("other-user", criteria);
  await store.create("google-subject", { ...criteria, bankId: "other-bank" });

  const jobs = await store.list("google-subject", "union-bank", { page: 1, pageSize: 10 });

  assert.equal(jobs.total, 2);
  assert.equal(jobs.jobs.length, 2);
  assert.equal(
    jobs.jobs.some((job) => job.id === requestedUserJob.id),
    true,
  );
  assert.equal(
    jobs.jobs.every((job) => job.googleSubject === "google-subject"),
    true,
  );

  const firstPage = await store.list("google-subject", "union-bank", {
    page: 1,
    pageSize: 1,
  });
  const secondPage = await store.list("google-subject", "union-bank", {
    page: 2,
    pageSize: 1,
  });
  assert.equal(firstPage.total, 2);
  assert.equal(firstPage.jobs.length, 1);
  assert.equal(secondPage.total, 2);
  assert.equal(secondPage.jobs.length, 1);
  assert.notEqual(firstPage.jobs[0].id, secondPage.jobs[0].id);
  database.close();
});
