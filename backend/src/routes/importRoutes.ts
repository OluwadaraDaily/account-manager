import type { Response } from "express";
import { Router } from "express";
import { appConfig } from "../config.js";
import {
  getGmailMessageMetadata,
  listGmailMessages,
  type GmailMessageMetadata,
} from "../integrations/google/gmailClient.js";
import { parseCookies } from "../http/cookies.js";
import { validateBody, validateQuery, type ValidatedLocals } from "../middleware/validation.js";
import type { ImportJobStore } from "../db/repositories/importJobStore.js";
import type { RefreshTokenStore } from "../db/repositories/refreshTokenStore.js";
import type { SessionStore } from "../db/repositories/sessionStore.js";
import { decryptToken } from "../security/encryption.js";
import { buildGmailSearchQuery } from "../import/gmailSearch.js";
import {
  createImportJobBodySchema,
  importMessageMetadataBodySchema,
  importMessagesQuerySchema,
} from "../validators/importValidators.js";

type ImportRouterDependencies = {
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  sessionStorePromise: Promise<SessionStore>;
  importJobStorePromise: Promise<ImportJobStore>;
};

export function createImportRouter({
  refreshTokenStorePromise,
  sessionStorePromise,
  importJobStorePromise,
}: ImportRouterDependencies) {
  const router = Router();

  async function getMetadataWithConcurrency(refreshToken: string, messageIds: string[]) {
    const results: GmailMessageMetadata[] = new Array(messageIds.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < messageIds.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await getGmailMessageMetadata({
          refreshToken,
          messageId: messageIds[index],
        });
      }
    }

    const workerCount = Math.min(5, messageIds.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  router.post(
    "/imports/gmail/jobs",
    validateBody(createImportJobBodySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof createImportJobBodySchema>>,
    ) => {
      const { senderEmail, after, before, subject, keyword } = response.locals.validatedBody;
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

      const importJobStore = await importJobStorePromise;
      const job = await importJobStore.create(account.googleSubject, {
        senderEmail: senderEmail ?? null,
        after: after ?? null,
        before: before ?? null,
        subject: subject ?? null,
        keyword: keyword ?? null,
      });

      response.status(202).json({ job });
    },
  );

  router.get(
    "/imports/gmail/messages",
    validateQuery(importMessagesQuerySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof importMessagesQuerySchema>>,
    ) => {
      const { pageToken, senderEmail, after, before, subject, keyword } =
        response.locals.validatedQuery;
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
          q: buildGmailSearchQuery({ senderEmail, after, before, subject, keyword }),
        });

        response.json(result);
      } catch {
        console.error("Gmail message listing failed.");
        response.status(502).json({ error: "Gmail messages could not be retrieved." });
      }
    },
  );

  router.post(
    "/imports/gmail/messages/metadata",
    validateBody(importMessageMetadataBodySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof importMessageMetadataBodySchema>>,
    ) => {
      const { messageIds } = response.locals.validatedBody;
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
        const messages = await getMetadataWithConcurrency(decryptToken(encryptedToken), messageIds);
        response.json({ messages });
      } catch {
        console.error("Gmail message metadata retrieval failed.");
        response.status(502).json({ error: "Gmail message details could not be retrieved." });
      }
    },
  );

  return router;
}
