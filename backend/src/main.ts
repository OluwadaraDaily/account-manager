import { createApp } from "./app.js";
import { appConfig } from "./config.js";
import { listGmailMessages } from "./gmailClient.js";
import { createRefreshTokenStore } from "./refreshTokenStore.js";
import { createSessionStore } from "./sessionStore.js";
import { decryptToken } from "./tokenCrypto.js";
import { parseCookies, serializeCookie } from "./http/cookies.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createHealthRouter } from "./routes/healthRoutes.js";

const app = createApp();
const refreshTokenStorePromise = createRefreshTokenStore();
const sessionStorePromise = createSessionStore();

app.use(createHealthRouter());
app.use(
  createAuthRouter({
    refreshTokenStorePromise,
    sessionStorePromise,
  }),
);

app.get("/imports/gmail/messages", async (request, response) => {
  const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
  const sessionStore = await sessionStorePromise;
  const account = sessionId ? await sessionStore.get(sessionId) : null;

  if (!account) {
    response.status(401).json({ error: "Gmail authentication is required." });
    return;
  }

  const refreshTokenStore = await refreshTokenStorePromise;
  const encryptedToken = await refreshTokenStore.get(account);

  if (!encryptedToken) {
    response.status(409).json({ error: "Gmail is not connected." });
    return;
  }

  const pageToken =
    typeof request.query.pageToken === "string" ? request.query.pageToken : undefined;

  try {
    const result = await listGmailMessages({
      refreshToken: decryptToken(encryptedToken),
      pageToken,
    });

    response.json(result);
  } catch {
    console.error("Gmail message listing failed.");
    response.status(502).json({ error: "Gmail messages could not be retrieved." });
  }
});

app.listen(appConfig.port, () => {
  console.log(`Account Manager backend listening on http://localhost:${appConfig.port}`);
});
