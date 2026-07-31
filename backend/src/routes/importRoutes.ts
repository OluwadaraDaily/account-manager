import type { Response } from "express";
import { Router } from "express";
import { appConfig } from "../config.js";
import { listGmailMessages } from "../integrations/google/gmailClient.js";
import { parseCookies } from "../http/cookies.js";
import { validateQuery, type ValidatedLocals } from "../middleware/validation.js";
import type { RefreshTokenStore } from "../db/repositories/refreshTokenStore.js";
import type { SessionStore } from "../db/repositories/sessionStore.js";
import { decryptToken } from "../tokenCrypto.js";
import { importMessagesQuerySchema } from "../validators/importValidators.js";

type ImportRouterDependencies = {
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  sessionStorePromise: Promise<SessionStore>;
};

export function createImportRouter({
  refreshTokenStorePromise,
  sessionStorePromise,
}: ImportRouterDependencies) {
  const router = Router();

  router.get(
    "/imports/gmail/messages",
    validateQuery(importMessagesQuerySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof importMessagesQuerySchema>>,
    ) => {
      const { pageToken } = response.locals.validatedQuery;
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
    },
  );

  return router;
}
