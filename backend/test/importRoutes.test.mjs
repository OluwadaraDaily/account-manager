import assert from "node:assert/strict";
import test from "node:test";

const [{ appConfig }, { createImportRouter, toImportJobSummary, toTransactionResponse }] =
  await Promise.all([import("../dist/config.js"), import("../dist/routes/importRoutes.js")]);

test("returns review metadata without account identity or raw Gmail content", () => {
  const response = toTransactionResponse({
    id: "transaction-1",
    googleSubject: "google-subject",
    bankId: "union-bank",
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
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });

  assert.deepEqual(response, {
    id: "transaction-1",
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
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });
});

test("updates a transaction through the authenticated bank-scoped endpoint", async () => {
  const updates = [];
  const router = createImportRouter({
    bankDirectoryStorePromise: Promise.resolve({}),
    refreshTokenStorePromise: Promise.resolve({}),
    sessionStorePromise: Promise.resolve({
      async get(sessionId) {
        return sessionId === "session-1" ? { googleSubject: "google-subject" } : null;
      },
    }),
    importJobStorePromise: Promise.resolve({}),
    transactionStorePromise: Promise.resolve({
      async update(googleSubject, bankId, transactionId, changes) {
        updates.push({ googleSubject, bankId, transactionId, changes });
        return {
          id: transactionId,
          googleSubject,
          bankId,
          sourceMessageId: "message-1",
          transactionDate: changes.transactionDate,
          direction: changes.direction,
          amount: changes.amount,
          currency: "NGN",
          counterparty: changes.counterparty,
          description: changes.description,
          channel: "POS",
          confidence: "high",
          reviewReasons: [],
          reviewStatus: changes.reviewStatus ?? "ready",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-02T00:00:00.000Z",
        };
      },
    }),
    runGmailImportJob: async () => {},
  });

  let resolveResponse;
  let rejectResponse;
  const responseCompleted = new Promise((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });
  const response = {
    locals: {},
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      resolveResponse();
      return this;
    },
  };

  router.handle(
    {
      method: "PATCH",
      url: "/imports/gmail/transactions/transaction-1",
      headers: { cookie: `${appConfig.sessionCookieName}=session-1` },
      body: {
        bankId: "union-bank",
        direction: "credit",
        transactionDate: "2026-02-02",
        amount: "543.21",
        counterparty: "Updated Merchant",
        description: "Updated description",
        reviewStatus: "dismissed",
      },
    },
    response,
    (error) => (error ? rejectResponse(error) : resolveResponse()),
  );
  await responseCompleted;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(updates, [
    {
      googleSubject: "google-subject",
      bankId: "union-bank",
      transactionId: "transaction-1",
      changes: {
        direction: "credit",
        transactionDate: "2026-02-02",
        amount: "543.21",
        counterparty: "Updated Merchant",
        description: "Updated description",
        reviewStatus: "dismissed",
      },
    },
  ]);
  assert.deepEqual(response.body, {
    transaction: {
      id: "transaction-1",
      sourceMessageId: "message-1",
      transactionDate: "2026-02-02",
      direction: "credit",
      amount: "543.21",
      currency: "NGN",
      counterparty: "Updated Merchant",
      description: "Updated description",
      channel: "POS",
      confidence: "high",
      reviewReasons: [],
      reviewStatus: "dismissed",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
    },
  });
});

test("lists historical import summaries for the authenticated user and bank", async () => {
  const calls = [];
  const router = createImportRouter({
    bankDirectoryStorePromise: Promise.resolve({}),
    refreshTokenStorePromise: Promise.resolve({}),
    sessionStorePromise: Promise.resolve({
      async get(sessionId) {
        return sessionId === "session-1" ? { googleSubject: "google-subject" } : null;
      },
    }),
    importJobStorePromise: Promise.resolve({
      async list(googleSubject, bankId, options) {
        calls.push({ googleSubject, bankId, options });
        return {
          total: 1,
          jobs: [
            {
              id: "job-1",
              googleSubject,
              status: "completed",
              criteria: {
                bankId,
                searchMode: "sender",
                senderEmail: "alerts@example.com",
                after: 1769904000,
                before: 1772582400,
                subject: "Transaction alert",
                keyword: null,
              },
              pageToken: "private-page-token",
              progress: {
                messagesDiscovered: 3,
                messagesProcessed: 3,
                transactionsExtracted: 2,
                messagesSkipped: 1,
              },
              errorMessage: null,
              createdAt: "2026-02-01T00:00:00.000Z",
              updatedAt: "2026-02-01T00:02:00.000Z",
              startedAt: "2026-02-01T00:00:30.000Z",
              completedAt: "2026-02-01T00:02:00.000Z",
            },
          ],
        };
      },
    }),
    transactionStorePromise: Promise.resolve({}),
    runGmailImportJob: async () => {},
  });

  let resolveResponse;
  let rejectResponse;
  const responseCompleted = new Promise((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });
  const response = {
    locals: {},
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      resolveResponse();
      return this;
    },
  };

  router.handle(
    {
      method: "GET",
      url: "/imports/gmail/jobs?bankId=union-bank&page=2&pageSize=10",
      query: { bankId: "union-bank", page: "2", pageSize: "10" },
      headers: { cookie: `${appConfig.sessionCookieName}=session-1` },
    },
    response,
    (error) => (error ? rejectResponse(error) : resolveResponse()),
  );
  await responseCompleted;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [
    {
      googleSubject: "google-subject",
      bankId: "union-bank",
      options: { page: 2, pageSize: 10 },
    },
  ]);
  assert.deepEqual(response.body, {
    jobs: [
      {
        id: "job-1",
        status: "completed",
        criteria: {
          bankId: "union-bank",
          searchMode: "sender",
          senderEmail: "alerts@example.com",
          after: 1769904000,
          before: 1772582400,
          subject: "Transaction alert",
          keyword: null,
        },
        progress: {
          messagesDiscovered: 3,
          messagesProcessed: 3,
          transactionsExtracted: 2,
          messagesSkipped: 1,
        },
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:02:00.000Z",
        startedAt: "2026-02-01T00:00:30.000Z",
        completedAt: "2026-02-01T00:02:00.000Z",
      },
    ],
    pagination: {
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: true,
    },
  });
  assert.deepEqual(
    toImportJobSummary({
      id: "job-1",
      googleSubject: "google-subject",
      status: "completed",
      criteria: {
        bankId: "union-bank",
        searchMode: "sender",
        senderEmail: "alerts@example.com",
        after: null,
        before: null,
        subject: null,
        keyword: null,
      },
      pageToken: "private-page-token",
      progress: {
        messagesDiscovered: 0,
        messagesProcessed: 0,
        transactionsExtracted: 0,
        messagesSkipped: 0,
      },
      errorMessage: null,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
    }),
    {
      id: "job-1",
      status: "completed",
      criteria: {
        bankId: "union-bank",
        searchMode: "sender",
        senderEmail: "alerts@example.com",
        after: null,
        before: null,
        subject: null,
        keyword: null,
      },
      progress: {
        messagesDiscovered: 0,
        messagesProcessed: 0,
        transactionsExtracted: 0,
        messagesSkipped: 0,
      },
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
    },
  );
});

test("lists imported banks for the authenticated user", async () => {
  const directoryLookups = [];
  const router = createImportRouter({
    bankDirectoryStorePromise: Promise.resolve({
      async get(bankId) {
        directoryLookups.push(bankId);
        return bankId === "union-bank" ? { displayName: "Union Bank" } : null;
      },
    }),
    refreshTokenStorePromise: Promise.resolve({}),
    sessionStorePromise: Promise.resolve({
      async get(sessionId) {
        return sessionId === "session-1" ? { googleSubject: "google-subject" } : null;
      },
    }),
    importJobStorePromise: Promise.resolve({
      async listImportedBanks(googleSubject) {
        assert.equal(googleSubject, "google-subject");
        return [
          {
            bankId: "union-bank",
            importCount: 2,
            latestImportAt: "2026-02-02T00:00:00.000Z",
          },
          {
            bankId: "retired-bank",
            importCount: 1,
            latestImportAt: "2026-01-02T00:00:00.000Z",
          },
        ];
      },
    }),
    transactionStorePromise: Promise.resolve({}),
    runGmailImportJob: async () => {},
  });

  let resolveResponse;
  let rejectResponse;
  const responseCompleted = new Promise((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });
  const response = {
    locals: {},
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      resolveResponse();
      return this;
    },
  };

  router.handle(
    {
      method: "GET",
      url: "/imports/gmail/banks",
      headers: { cookie: `${appConfig.sessionCookieName}=session-1` },
    },
    response,
    (error) => (error ? rejectResponse(error) : resolveResponse()),
  );
  await responseCompleted;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(directoryLookups, ["union-bank", "retired-bank"]);
  assert.deepEqual(response.body, {
    banks: [
      {
        bankId: "union-bank",
        displayName: "Union Bank",
        importCount: 2,
        latestImportAt: "2026-02-02T00:00:00.000Z",
      },
      {
        bankId: "retired-bank",
        displayName: "retired-bank",
        importCount: 1,
        latestImportAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  });
});

test("lists transactions for an authenticated import job and enforces bank scope", async () => {
  const calls = [];
  const router = createImportRouter({
    bankDirectoryStorePromise: Promise.resolve({}),
    refreshTokenStorePromise: Promise.resolve({
      async get() {
        return null;
      },
    }),
    sessionStorePromise: Promise.resolve({
      async get(sessionId) {
        return sessionId === "session-1" ? { googleSubject: "google-subject" } : null;
      },
    }),
    importJobStorePromise: Promise.resolve({
      async get(jobId, googleSubject) {
        return jobId === "job-1" && googleSubject === "google-subject"
          ? {
              id: "job-1",
              googleSubject,
              status: "completed",
              criteria: {
                bankId: "union-bank",
                searchMode: "sender",
                senderEmail: "alerts@example.com",
                after: null,
                before: null,
                subject: null,
                keyword: null,
              },
              pageToken: null,
              progress: {
                messagesDiscovered: 1,
                messagesProcessed: 1,
                transactionsExtracted: 1,
                messagesSkipped: 0,
              },
              errorMessage: null,
              createdAt: "2026-02-01T00:00:00.000Z",
              updatedAt: "2026-02-01T00:00:00.000Z",
              startedAt: "2026-02-01T00:00:00.000Z",
              completedAt: "2026-02-01T00:00:00.000Z",
            }
          : null;
      },
    }),
    transactionStorePromise: Promise.resolve({
      async listForImportJob(googleSubject, bankId, jobId) {
        calls.push({ googleSubject, bankId, jobId });
        return [
          {
            id: "transaction-1",
            googleSubject,
            bankId,
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
            createdAt: "2026-02-01T00:00:00.000Z",
            updatedAt: "2026-02-01T00:00:00.000Z",
          },
        ];
      },
    }),
    runGmailImportJob: async () => {},
  });

  const runRequest = (url, sessionId = "session-1") =>
    new Promise((resolve, reject) => {
      const response = {
        locals: {},
        statusCode: 200,
        body: null,
        status(statusCode) {
          this.statusCode = statusCode;
          return this;
        },
        json(body) {
          this.body = body;
          resolve(this);
          return this;
        },
      };
      router.handle(
        {
          method: "GET",
          url,
          query: Object.fromEntries(new URL(`http://localhost${url}`).searchParams),
          headers: { cookie: `${appConfig.sessionCookieName}=${sessionId}` },
        },
        response,
        (error) => (error ? reject(error) : resolve(response)),
      );
    });

  const response = await runRequest("/imports/gmail/jobs/job-1/transactions?bankId=union-bank");
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [
    { googleSubject: "google-subject", bankId: "union-bank", jobId: "job-1" },
  ]);
  assert.deepEqual(response.body.transactions, [
    {
      id: "transaction-1",
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
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
  ]);

  const wrongBankResponse = await runRequest(
    "/imports/gmail/jobs/job-1/transactions?bankId=other-bank",
  );
  assert.equal(wrongBankResponse.statusCode, 404);
  const otherUserResponse = await runRequest(
    "/imports/gmail/jobs/job-1/transactions?bankId=union-bank",
    "other-session",
  );
  assert.equal(otherUserResponse.statusCode, 401);
});
