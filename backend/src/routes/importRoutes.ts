import type { Response } from "express";
import { Router } from "express";
import { appConfig } from "../config.js";
import type { BankDirectoryStore } from "../db/repositories/bankDirectoryStore.js";
import {
  getGmailMessageMetadata,
  listGmailMessages,
  type GmailMessageMetadata,
} from "../integrations/google/gmailClient.js";
import { parseCookies } from "../http/cookies.js";
import { validateBody, validateQuery, type ValidatedLocals } from "../middleware/validation.js";
import type { ImportJob, ImportJobStore } from "../db/repositories/importJobStore.js";
import type { RefreshTokenStore } from "../db/repositories/refreshTokenStore.js";
import type { SessionStore } from "../db/repositories/sessionStore.js";
import type {
  StoredNormalizedTransaction,
  TransactionStore,
} from "../db/repositories/transactionStore.js";
import type { createGmailImportJobRunner } from "../import/gmailImportJobRunner.js";
import { decryptToken } from "../security/encryption.js";
import { buildGmailSearchQuery } from "../import/gmailSearch.js";
import {
  createImportJobBodySchema,
  importMessageMetadataBodySchema,
  importJobsQuerySchema,
  importMessagesQuerySchema,
  importTransactionsQuerySchema,
  updateImportJobBodySchema,
  updateImportedTransactionBodySchema,
} from "../validators/importValidators.js";

type ImportRouterDependencies = {
  bankDirectoryStorePromise: Promise<BankDirectoryStore>;
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  sessionStorePromise: Promise<SessionStore>;
  importJobStorePromise: Promise<ImportJobStore>;
  transactionStorePromise: Promise<TransactionStore>;
  runGmailImportJob: ReturnType<typeof createGmailImportJobRunner>;
};

export function toTransactionResponse(transaction: StoredNormalizedTransaction) {
  const { googleSubject: _googleSubject, bankId: _bankId, ...safeTransaction } = transaction;
  return safeTransaction;
}

export function toImportJobSummary(job: ImportJob) {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    criteria: job.criteria,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

export function createImportRouter({
  bankDirectoryStorePromise,
  refreshTokenStorePromise,
  sessionStorePromise,
  importJobStorePromise,
  transactionStorePromise,
  runGmailImportJob,
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
      const { bankId, name, searchMode, senderEmail, after, before, subject, keyword } =
        response.locals.validatedBody;
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

      const bankDirectoryStore = await bankDirectoryStorePromise;
      const bank = await bankDirectoryStore.get(bankId);

      if (!bank || bank.status === "inactive") {
        response.status(400).json({ error: "The selected bank is not available for import." });
        return;
      }

      if (searchMode === "bank-fallback" && bank.verificationStatus !== "verified") {
        response
          .status(400)
          .json({ error: "The selected bank is not verified for fallback search." });
        return;
      }

      const resolvedSenderEmail =
        searchMode === "bank-fallback"
          ? null
          : (senderEmail ?? bank.transactionNotificationSenderEmail);
      if (searchMode === "sender" && !resolvedSenderEmail) {
        response.status(400).json({
          error: "A transaction sender email is required before importing this bank.",
        });
        return;
      }

      const importJobStore = await importJobStorePromise;
      const job = await importJobStore.create(
        account.googleSubject,
        {
          bankId,
          searchMode,
          senderEmail: resolvedSenderEmail,
          after: after ?? null,
          before: before ?? null,
          subject: subject ?? null,
          keyword: keyword ?? null,
        },
        name ?? null,
      );

      response.status(202).json({ job });
      void runGmailImportJob(job.id, account.googleSubject);
    },
  );

  router.patch(
    "/imports/gmail/jobs/:jobId",
    validateBody(updateImportJobBodySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof updateImportJobBodySchema>>,
    ) => {
      const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
      const sessionStore = await sessionStorePromise;
      const account = sessionId ? await sessionStore.get(sessionId) : null;

      if (!account) {
        response.status(401).json({ error: "Gmail authentication is required." });
        return;
      }

      const importJobStore = await importJobStorePromise;
      const job = await importJobStore.update(
        request.params.jobId as string,
        account.googleSubject,
        {
          name: response.locals.validatedBody.name,
        },
      );

      if (!job) {
        response.status(404).json({ error: "Import job was not found." });
        return;
      }

      response.json({ job });
    },
  );

  router.get("/imports/gmail/banks", async (request, response) => {
    const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
    const sessionStore = await sessionStorePromise;
    const account = sessionId ? await sessionStore.get(sessionId) : null;

    if (!account) {
      response.status(401).json({ error: "Gmail authentication is required." });
      return;
    }

    const importJobStore = await importJobStorePromise;
    const summaries = await importJobStore.listImportedBanks(account.googleSubject);
    const bankDirectoryStore = await bankDirectoryStorePromise;
    const banks = await Promise.all(
      summaries.map(async (summary) => {
        const bank = await bankDirectoryStore.get(summary.bankId);
        return {
          bankId: summary.bankId,
          displayName: bank?.displayName ?? summary.bankId,
          importCount: summary.importCount,
          latestImportAt: summary.latestImportAt,
        };
      }),
    );

    response.json({ banks });
  });

  router.get(
    "/imports/gmail/jobs",
    validateQuery(importJobsQuerySchema),
    async (request, response: Response<unknown, ValidatedLocals<typeof importJobsQuerySchema>>) => {
      const { bankId, page, pageSize } = response.locals.validatedQuery;
      const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
      const sessionStore = await sessionStorePromise;
      const account = sessionId ? await sessionStore.get(sessionId) : null;

      if (!account) {
        response.status(401).json({ error: "Gmail authentication is required." });
        return;
      }

      const importJobStore = await importJobStorePromise;
      const result = await importJobStore.list(account.googleSubject, bankId, { page, pageSize });
      const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / pageSize);
      response.json({
        jobs: result.jobs.map(toImportJobSummary),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages,
          hasNext: totalPages > 0 && page < totalPages,
          hasPrevious: page > 1 && totalPages > 0,
        },
      });
    },
  );

  router.get(
    "/imports/gmail/jobs/:jobId/transactions",
    validateQuery(importTransactionsQuerySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof importTransactionsQuerySchema>>,
    ) => {
      const { bankId, page, pageSize } = response.locals.validatedQuery;
      const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
      const sessionStore = await sessionStorePromise;
      const account = sessionId ? await sessionStore.get(sessionId) : null;

      if (!account) {
        response.status(401).json({ error: "Gmail authentication is required." });
        return;
      }

      const jobId = request.params.jobId;
      if (typeof jobId !== "string") {
        response.status(400).json({ error: "Invalid import job identifier." });
        return;
      }

      const importJobStore = await importJobStorePromise;
      const job = await importJobStore.get(jobId, account.googleSubject);
      if (!job || job.criteria.bankId !== bankId) {
        response.status(404).json({ error: "Import job was not found." });
        return;
      }

      const transactionStore = await transactionStorePromise;
      const result = await transactionStore.listForImportJobPage(
        account.googleSubject,
        bankId,
        job.id,
        { page, pageSize },
      );
      const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / pageSize);
      response.json({
        transactions: result.transactions.map(toTransactionResponse),
        reviewCounts: result.reviewCounts,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages,
          hasNext: totalPages > 0 && page < totalPages,
          hasPrevious: page > 1 && totalPages > 0,
        },
      });
    },
  );

  router.get("/imports/gmail/jobs/:jobId", async (request, response) => {
    const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
    const sessionStore = await sessionStorePromise;
    const account = sessionId ? await sessionStore.get(sessionId) : null;

    if (!account) {
      response.status(401).json({ error: "Gmail authentication is required." });
      return;
    }

    const importJobStore = await importJobStorePromise;
    const job = await importJobStore.get(request.params.jobId, account.googleSubject);

    if (!job) {
      response.status(404).json({ error: "Import job was not found." });
      return;
    }

    response.json({ job });
  });

  router.get(
    "/imports/gmail/transactions",
    validateQuery(importTransactionsQuerySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof importTransactionsQuerySchema>>,
    ) => {
      const { bankId, page, pageSize } = response.locals.validatedQuery;
      const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
      const sessionStore = await sessionStorePromise;
      const account = sessionId ? await sessionStore.get(sessionId) : null;

      if (!account) {
        response.status(401).json({ error: "Gmail authentication is required." });
        return;
      }

      const transactionStore = await transactionStorePromise;
      const result = await transactionStore.listPage(account.googleSubject, bankId, {
        page,
        pageSize,
      });
      const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / pageSize);
      response.json({
        transactions: result.transactions.map(toTransactionResponse),
        reviewCounts: result.reviewCounts,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages,
          hasNext: totalPages > 0 && page < totalPages,
          hasPrevious: page > 1 && totalPages > 0,
        },
      });
    },
  );

  router.patch(
    "/imports/gmail/transactions/:transactionId",
    validateBody(updateImportedTransactionBodySchema),
    async (
      request,
      response: Response<unknown, ValidatedLocals<typeof updateImportedTransactionBodySchema>>,
    ) => {
      const { bankId, ...changes } = response.locals.validatedBody;
      const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
      const sessionStore = await sessionStorePromise;
      const account = sessionId ? await sessionStore.get(sessionId) : null;

      if (!account) {
        response.status(401).json({ error: "Gmail authentication is required." });
        return;
      }

      const transactionId = request.params.transactionId;
      if (typeof transactionId !== "string") {
        response.status(400).json({ error: "Invalid transaction identifier." });
        return;
      }

      const transactionStore = await transactionStorePromise;
      const transaction = await transactionStore.update(
        account.googleSubject,
        bankId,
        transactionId,
        changes,
      );

      if (!transaction) {
        response.status(404).json({ error: "Transaction was not found." });
        return;
      }

      response.json({ transaction: toTransactionResponse(transaction) });
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
