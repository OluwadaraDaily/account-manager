import assert from "node:assert/strict";
import test from "node:test";

const [{ appConfig }, { createGroupingRouter }] = await Promise.all([
  import("../dist/config.js"),
  import("../dist/routes/groupingRoutes.js"),
]);

function dispatch(router, request) {
  return new Promise((resolve, reject) => {
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
      sendStatus(statusCode) {
        this.statusCode = statusCode;
        resolve(this);
        return this;
      },
    };
    router.handle(request, response, (error) => (error ? reject(error) : resolve(response)));
  });
}

test("requires Gmail authentication for group routes", async () => {
  const router = createGroupingRouter({
    groupingStorePromise: Promise.resolve({}),
    sessionStorePromise: Promise.resolve({ async get() { return null; } }),
  });
  const response = await dispatch(router, {
    method: "GET",
    url: "/groups?bankId=union-bank",
    headers: {},
    query: { bankId: "union-bank" },
  });
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "Gmail authentication is required." });
});

test("creates and lists groups in the authenticated user's bank scope", async () => {
  const calls = [];
  const group = {
    id: "group-1",
    googleSubject: "google-subject",
    bankId: "union-bank",
    name: "Weekend treats",
    transactionCount: 0,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
  const router = createGroupingRouter({
    groupingStorePromise: Promise.resolve({
      async create(input) {
        calls.push({ action: "create", input });
        return group;
      },
      async list(googleSubject, bankId) {
        calls.push({ action: "list", googleSubject, bankId });
        return [group];
      },
    }),
    sessionStorePromise: Promise.resolve({
      async get(sessionId) {
        return sessionId === "session-1" ? { googleSubject: "google-subject" } : null;
      },
    }),
  });

  const created = await dispatch(router, {
    method: "POST",
    url: "/groups",
    headers: { cookie: `${appConfig.sessionCookieName}=session-1` },
    body: { bankId: "union-bank", name: " Weekend treats " },
  });
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.body, {
    group: {
      id: "group-1",
      name: "Weekend treats",
      transactionCount: 0,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
  });

  const listed = await dispatch(router, {
    method: "GET",
    url: "/groups?bankId=union-bank",
    headers: { cookie: `${appConfig.sessionCookieName}=session-1` },
    query: { bankId: "union-bank" },
  });
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(calls, [
    {
      action: "create",
      input: { googleSubject: "google-subject", bankId: "union-bank", name: "Weekend treats" },
    },
    { action: "list", googleSubject: "google-subject", bankId: "union-bank" },
  ]);
});
