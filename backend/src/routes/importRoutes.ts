import { Router } from "express";
import { appConfig } from "../config.js";
import { listGmailMessages } from "../gmailClient.js";
import { parseCookies } from "../http/cookies.js";
import type { RefreshTokenStore } from "../refreshTokenStore.js";
import type { SessionStore } from "../sessionStore.js";
import { decryptToken } from "../tokenCrypto.js";

type ImportRouterDependencies = {
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  sessionStorePromise: Promise<SessionStore>;
};

export function createImportRouter({
  refreshTokenStorePromise,
  sessionStorePromise,
}: ImportRouterDependencies) {
  const router = Router();

  router.get("/imports/gmail/messages", async (request, response) => {
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

  return router;
}
