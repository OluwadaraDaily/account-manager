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

test("lists imported banks only for the requested user with import counts", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteImportJobStore(database, false);

  const criteria = {
    bankId: "union-bank",
    searchMode: "sender",
    senderEmail: "alerts@example.com",
    after: null,
    before: null,
    subject: null,
    keyword: null,
  };
  await store.create("google-subject", criteria);
  const latestUnionJob = await store.create("google-subject", criteria);
  await store.create("google-subject", { ...criteria, bankId: "access-bank" });
  await store.create("other-user", { ...criteria, bankId: "other-bank" });

  const banks = await store.listImportedBanks("google-subject");

  assert.deepEqual(
    banks.map(({ bankId, importCount }) => ({ bankId, importCount })),
    [
      { bankId: "access-bank", importCount: 1 },
      { bankId: "union-bank", importCount: 2 },
    ],
  );
  assert.equal(
    banks.find((bank) => bank.bankId === "union-bank")?.latestImportAt,
    latestUnionJob.createdAt,
  );
  assert.deepEqual(await store.listImportedBanks("other-user"), [
    {
      bankId: "other-bank",
      importCount: 1,
      latestImportAt: (await store.list("other-user", "other-bank", { page: 1, pageSize: 1 }))
        .jobs[0].createdAt,
    },
  ]);
  database.close();
});

test("lists queued and running jobs for startup recovery", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteImportJobStore(database, false);

  const criteria = {
    bankId: "union-bank",
    searchMode: "sender",
    senderEmail: "alerts@example.com",
    after: null,
    before: null,
    subject: null,
    keyword: null,
  };
  const queuedJob = await store.create("google-subject", criteria);
  const runningJob = await store.create("google-subject", criteria);
  await store.update(runningJob.id, runningJob.googleSubject, { status: "running" });
  const completedJob = await store.create("google-subject", criteria);
  await store.update(completedJob.id, completedJob.googleSubject, { status: "completed" });

  const unfinishedJobs = await store.listUnfinished();

  assert.deepEqual(
    unfinishedJobs.map((job) => job.id).sort(),
    [queuedJob.id, runningJob.id].sort(),
  );
  database.close();
});

test("claims a queued job only once", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteImportJobStore(database, false);
  const job = await store.create("google-subject", {
    bankId: "union-bank",
    searchMode: "sender",
    senderEmail: "alerts@example.com",
    after: null,
    before: null,
    subject: null,
    keyword: null,
  });

  assert.equal((await store.claim(job.id, job.googleSubject))?.status, "running");
  assert.equal(await store.claim(job.id, job.googleSubject), null);
  database.close();
});

test("returns empty history for a user with no imports", async () => {
  const database = createSqliteDatabase(":memory:");
  await initializeDatabase({ dialect: "sqlite", database, close: async () => database.close() });
  const store = new SqliteImportJobStore(database, false);

  assert.deepEqual(await store.listImportedBanks("google-subject"), []);
  assert.deepEqual(await store.list("google-subject", "union-bank", { page: 1, pageSize: 10 }), {
    jobs: [],
    total: 0,
  });
  database.close();
});
