import assert from "node:assert/strict";
import test from "node:test";

const [{ appConfig }, { createImportRouter, toTransactionResponse }] = await Promise.all([
  import("../dist/config.js"),
  import("../dist/routes/importRoutes.js"),
]);

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
