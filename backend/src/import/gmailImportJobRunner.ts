import {
  getGmailMessageContent,
  listGmailMessages,
  type GmailMessageContent,
  type GmailMessageList,
} from "../integrations/google/gmailClient.js";
import type { ImportJobStore } from "../db/repositories/importJobStore.js";
import type { BankDirectoryStore } from "../db/repositories/bankDirectoryStore.js";
import type { RefreshTokenStore } from "../db/repositories/refreshTokenStore.js";
import { parseUnionBankTransaction } from "../parsers/unionBankParser.js";
import { decryptToken } from "../security/encryption.js";
import { buildGmailSearchQuery } from "./gmailSearch.js";

type GmailImportJobRunnerDependencies = {
  importJobStorePromise: Promise<ImportJobStore>;
  bankDirectoryStorePromise?: Promise<BankDirectoryStore>;
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  listMessages?: typeof listGmailMessages;
  getMessageContent?: typeof getGmailMessageContent;
};

export function createGmailImportJobRunner({
  importJobStorePromise,
  bankDirectoryStorePromise,
  refreshTokenStorePromise,
  listMessages = listGmailMessages,
  getMessageContent = getGmailMessageContent,
}: GmailImportJobRunnerDependencies) {
  return async function runGmailImportJob(jobId: string, googleSubject: string) {
    const importJobStore = await importJobStorePromise;
    const job = await importJobStore.get(jobId, googleSubject);

    if (!job || job.status !== "queued") return;

    const startedAt = new Date().toISOString();
    await importJobStore.update(job.id, googleSubject, {
      status: "running",
      startedAt,
      errorMessage: null,
    });

    try {
      const refreshTokenStore = await refreshTokenStorePromise;
      const encryptedToken = await refreshTokenStore.get({ googleSubject });

      if (!encryptedToken) throw new Error("Gmail is no longer connected.");

      const query = buildGmailSearchQuery({
        senderEmail: job.criteria.senderEmail ?? undefined,
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
      const bankDirectoryStore = bankDirectoryStorePromise ? await bankDirectoryStorePromise : null;

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

            const messageSender = messageContent.headers.from
              ?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
              ?.toLowerCase();
            if (
              !senderConfirmed &&
              bankDirectoryStore &&
              job.criteria.bankId &&
              senderEmail &&
              messageSender === senderEmail
            ) {
              const savedBank = await bankDirectoryStore.setTransactionNotificationSender(
                job.criteria.bankId,
                senderEmail,
              );
              if (savedBank) senderConfirmed = true;
            }

            const transaction = parseUnionBankTransaction(messageContent);
            messagesProcessed += 1;

            if (transaction) {
              transactionsExtracted += 1;
            } else {
              messagesSkipped += 1;
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
    } catch {
      await importJobStore.update(job.id, googleSubject, {
        status: "failed",
        errorMessage: "Gmail import failed.",
        completedAt: new Date().toISOString(),
      });
      console.error("Gmail import job failed.");
    }
  };
}
