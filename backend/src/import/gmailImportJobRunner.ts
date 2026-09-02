import {
  getGmailMessageContent,
  TemporaryGmailError,
  listGmailMessages,
  type GmailMessageContent,
  type GmailMessageList,
} from "../integrations/google/gmailClient.js";
import type { ImportJobStore } from "../db/repositories/importJobStore.js";
import type { ImportJobTransactionStore } from "../db/repositories/importJobTransactionStore.js";
import type { BankDirectoryStore } from "../db/repositories/bankDirectoryStore.js";
import type { RefreshTokenStore } from "../db/repositories/refreshTokenStore.js";
import type { TransactionStore } from "../db/repositories/transactionStore.js";
import { parseUnionBankTransaction } from "../parsers/unionBankParser.js";
import { parseAccessBankTransaction } from "../parsers/accessBankParser.js";
import { decryptToken } from "../security/encryption.js";
import { buildGmailSearchQuery } from "./gmailSearch.js";
import { buildTransactionFingerprint } from "./transactionFingerprint.js";

function messageBelongsToSelectedBank(
  messageSender: string | null,
  expectedSenderEmail: string | null,
  officialDomains: string[],
) {
  if (!messageSender) return false;
  if (expectedSenderEmail) return messageSender === expectedSenderEmail;

  const senderDomain = messageSender.split("@").at(-1)?.toLowerCase();
  if (!senderDomain) return false;

  return officialDomains.some((officialDomain) => {
    const normalizedDomain = officialDomain.toLowerCase();
    return senderDomain === normalizedDomain || senderDomain.endsWith(`.${normalizedDomain}`);
  });
}

type GmailImportJobRunnerDependencies = {
  importJobStorePromise: Promise<ImportJobStore>;
  importJobTransactionStorePromise: Promise<ImportJobTransactionStore>;
  bankDirectoryStorePromise: Promise<BankDirectoryStore>;
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  transactionStorePromise: Promise<TransactionStore>;
  listMessages?: typeof listGmailMessages;
  getMessageContent?: typeof getGmailMessageContent;
  scheduleRetry?: (jobId: string, googleSubject: string, delayMs: number) => void;
};

export function createGmailImportJobRunner({
  importJobStorePromise,
  importJobTransactionStorePromise,
  bankDirectoryStorePromise,
  refreshTokenStorePromise,
  transactionStorePromise,
  listMessages = listGmailMessages,
  getMessageContent = getGmailMessageContent,
  scheduleRetry,
}: GmailImportJobRunnerDependencies) {
  const maxJobAttempts = 3;
  const retryDelayMs = 3_000;
  const retryJitterMs = 1_000;

  let runGmailImportJob: (jobId: string, googleSubject: string) => Promise<void>;
  const schedule =
    scheduleRetry ??
    ((jobId: string, googleSubject: string, delayMs: number) => {
      setTimeout(() => void runGmailImportJob(jobId, googleSubject), delayMs);
    });

  runGmailImportJob = async function runGmailImportJob(jobId: string, googleSubject: string) {
    const importJobStore = await importJobStorePromise;
    const existingJob = await importJobStore.get(jobId, googleSubject);

    if (!existingJob || existingJob.status !== "queued") return;

    const job = await importJobStore.claim(jobId, googleSubject);
    if (!job) return;

    try {
      const refreshTokenStore = await refreshTokenStorePromise;
      const encryptedToken = await refreshTokenStore.get({ googleSubject });

      if (!encryptedToken) throw new Error("Gmail is no longer connected.");

      const bankId = job.criteria.bankId;
      if (!bankId) {
        throw new Error("A selected bank is required before transactions can be persisted.");
      }

      const bankDirectoryStore = await bankDirectoryStorePromise;
      const selectedBank = await bankDirectoryStore.get(bankId);
      if (!selectedBank || selectedBank.status === "inactive") {
        throw new Error("The selected bank is not available for import.");
      }

      const fallbackBank = job.criteria.searchMode === "bank-fallback" ? selectedBank : null;

      if (
        job.criteria.searchMode === "bank-fallback" &&
        (!fallbackBank ||
          fallbackBank.status === "inactive" ||
          fallbackBank.verificationStatus !== "verified")
      ) {
        throw new Error("The selected bank is not verified for fallback search.");
      }

      const transactionStore = await transactionStorePromise;
      const importJobTransactionStore = await importJobTransactionStorePromise;

      const query = buildGmailSearchQuery({
        senderEmail:
          job.criteria.searchMode === "bank-fallback"
            ? undefined
            : (job.criteria.senderEmail ?? undefined),
        bankDomains: fallbackBank?.officialDomains,
        bankSearchTerms: fallbackBank?.searchTerms,
        after: job.criteria.after ?? undefined,
        before: job.criteria.before ?? undefined,
        subject: job.criteria.subject ?? undefined,
        keyword: job.criteria.keyword ?? undefined,
      });
      const refreshToken = decryptToken(encryptedToken);
      let pageToken = job.pageToken ?? undefined;
      let messagesDiscovered = job.progress.messagesDiscovered;
      let messagesProcessed = job.progress.messagesProcessed;
      let transactionsExtracted = job.progress.transactionsExtracted;
      let messagesSkipped = job.progress.messagesSkipped;
      let senderConfirmed = false;
      const senderEmail = job.criteria.senderEmail?.toLowerCase() ?? null;
      const expectedSenderEmail =
        job.criteria.searchMode === "sender"
          ? (senderEmail ?? selectedBank.transactionNotificationSenderEmail?.toLowerCase() ?? null)
          : null;

      do {
        const result: GmailMessageList = await listMessages({ refreshToken, pageToken, q: query });
        messagesDiscovered += result.messages.length;

        for (const messageReference of result.messages) {
          let messageContent: GmailMessageContent | null = null;

          try {
            messageContent = await getMessageContent({
              refreshToken,
              messageId: messageReference.id,
            });

            const messageSender =
              messageContent.headers.from
                ?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
                ?.toLowerCase() ?? null;
            const belongsToSelectedBank = messageBelongsToSelectedBank(
              messageSender,
              expectedSenderEmail,
              selectedBank.officialDomains,
            );

            messagesProcessed += 1;

            if (!belongsToSelectedBank) {
              messagesSkipped += 1;
            } else {
              if (!senderConfirmed && senderEmail && messageSender === senderEmail) {
                const savedBank = await bankDirectoryStore.setTransactionNotificationSender(
                  bankId,
                  senderEmail,
                );
                if (savedBank) senderConfirmed = true;
              }

              const transaction =
                bankId === "access-bank"
                  ? parseAccessBankTransaction(messageContent)
                  : bankId === "union-bank" ? parseUnionBankTransaction(messageContent)
                  : null;

              if (transaction) {
                const existingTransaction = await transactionStore.findByFingerprint(
                  googleSubject,
                  bankId,
                  buildTransactionFingerprint(transaction),
                );

                if (
                  existingTransaction &&
                  existingTransaction.sourceMessageId !== transaction.sourceMessageId
                ) {
                  await importJobTransactionStore.link(
                    googleSubject,
                    bankId,
                    job.id,
                    existingTransaction.id,
                  );
                  messagesSkipped += 1;
                } else {
                  const savedTransaction = await transactionStore.upsert({
                    googleSubject,
                    bankId,
                    transaction,
                  });
                  await importJobTransactionStore.link(
                    googleSubject,
                    bankId,
                    job.id,
                    savedTransaction.id,
                  );
                  transactionsExtracted += 1;
                }
              } else {
                messagesSkipped += 1;
              }
            }
          } finally {
            messageContent = null;
          }

          await importJobStore.update(job.id, googleSubject, {
            status: "running",
            messagesDiscovered,
            messagesProcessed,
            transactionsExtracted,
            messagesSkipped,
          });
        }

        pageToken = result.nextPageToken;

        await importJobStore.update(job.id, googleSubject, {
          status: pageToken ? "running" : "completed",
          pageToken: pageToken ?? null,
          messagesDiscovered,
          ...(pageToken ? {} : { completedAt: new Date().toISOString() }),
        });
      } while (pageToken);
    } catch (error) {
      if (error instanceof TemporaryGmailError && job.attemptCount < maxJobAttempts) {
        const jitter = Math.floor(Math.random() * (retryJitterMs + 1));
        await importJobStore.update(job.id, googleSubject, {
          status: "queued",
          errorMessage: "Gmail temporarily unavailable; retrying.",
          startedAt: null,
          nextAttemptAt: new Date(Date.now() + retryDelayMs + jitter).toISOString(),
        });
        schedule(job.id, googleSubject, retryDelayMs + jitter);
      } else {
        await importJobStore.update(job.id, googleSubject, {
          status: "failed",
          errorMessage:
            error instanceof TemporaryGmailError
              ? "Gmail import failed after three attempts."
              : "Gmail import failed.",
          completedAt: new Date().toISOString(),
        });
      }
      console.error("Gmail import job failed:", error);
    }
  };

  return runGmailImportJob;
}
