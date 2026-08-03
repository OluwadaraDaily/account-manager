import { listGmailMessages, type GmailMessageList } from "../integrations/google/gmailClient.js";
import type { ImportJobStore } from "../db/repositories/importJobStore.js";
import type { RefreshTokenStore } from "../db/repositories/refreshTokenStore.js";
import { decryptToken } from "../security/encryption.js";
import { buildGmailSearchQuery } from "./gmailSearch.js";

type GmailImportJobRunnerDependencies = {
  importJobStorePromise: Promise<ImportJobStore>;
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  listMessages?: typeof listGmailMessages;
};

export function createGmailImportJobRunner({
  importJobStorePromise,
  refreshTokenStorePromise,
  listMessages = listGmailMessages,
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

      do {
        const result: GmailMessageList = await listMessages({ refreshToken, pageToken, q: query });
        messagesDiscovered += result.messages.length;
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
        errorMessage: "Gmail import discovery failed.",
        completedAt: new Date().toISOString(),
      });
      console.error("Gmail import job failed.");
    }
  };
}
