import assert from "node:assert/strict";
import test from "node:test";

process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

const [{ listGmailMessages }, { OAuth2Client }] = await Promise.all([
  import("../dist/integrations/google/gmailClient.js"),
  import("google-auth-library"),
]);

test("retries a temporary Gmail API failure", async (t) => {
  let attempts = 0;
  t.mock.method(OAuth2Client.prototype, "getAccessToken", async () => ({ token: "access-token" }));
  t.mock.method(globalThis, "fetch", async () => {
    attempts += 1;
    if (attempts === 1) return new Response(null, { status: 503, headers: { "retry-after": "0" } });
    return new Response(JSON.stringify({ messages: [] }), { status: 200 });
  });

  const result = await listGmailMessages({ refreshToken: "refresh-token" });

  assert.deepEqual(result, { messages: [] });
  assert.equal(attempts, 2);
});

test("does not retry a permanent Gmail API failure", async (t) => {
  let attempts = 0;
  t.mock.method(OAuth2Client.prototype, "getAccessToken", async () => ({ token: "access-token" }));
  t.mock.method(globalThis, "fetch", async () => {
    attempts += 1;
    return new Response(null, { status: 400 });
  });

  await assert.rejects(
    listGmailMessages({ refreshToken: "refresh-token" }),
    /Gmail message listing failed with status 400\./,
  );
  assert.equal(attempts, 1);
});

test("includes Gmail's structured error reason for diagnostics", async (t) => {
  t.mock.method(OAuth2Client.prototype, "getAccessToken", async () => ({ token: "access-token" }));
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "User rate limit exceeded.",
            errors: [{ reason: "userRateLimitExceeded", message: "User rate limit exceeded." }],
          },
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
  );

  await assert.rejects(
    listGmailMessages({ refreshToken: "refresh-token" }),
    /Gmail message listing failed with status 403 \(userRateLimitExceeded: User rate limit exceeded\.\)\./,
  );
});
