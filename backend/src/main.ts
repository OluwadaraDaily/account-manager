import type { Server } from "node:http";
import { createApp } from "./app.js";
import { appConfig } from "./config.js";
import { createDatabaseConnection } from "./db/database.js";
import { createBankDirectoryStore } from "./db/repositories/bankDirectoryStore.js";
import { createImportJobStore } from "./db/repositories/importJobStore.js";
import { createImportJobTransactionStore } from "./db/repositories/importJobTransactionStore.js";
import { initializeDatabase } from "./db/schema.js";
import { createRefreshTokenStore } from "./db/repositories/refreshTokenStore.js";
import { createSessionStore } from "./db/repositories/sessionStore.js";
import { createTransactionStore } from "./db/repositories/transactionStore.js";
import { createGmailImportJobRunner } from "./import/gmailImportJobRunner.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createBankRouter } from "./routes/bankRoutes.js";
import { createHealthRouter } from "./routes/healthRoutes.js";
import { createImportRouter } from "./routes/importRoutes.js";

const app = createApp();
const databaseConnection = createDatabaseConnection();
const databaseReady = initializeDatabase(databaseConnection);
const refreshTokenStorePromise = databaseReady.then(() =>
  createRefreshTokenStore(databaseConnection),
);
const sessionStorePromise = databaseReady.then(() => createSessionStore(databaseConnection));
const importJobStorePromise = databaseReady.then(() => createImportJobStore(databaseConnection));
const importJobTransactionStorePromise = databaseReady.then(() =>
  createImportJobTransactionStore(databaseConnection),
);
const bankDirectoryStorePromise = databaseReady.then(() =>
  createBankDirectoryStore(databaseConnection),
);
const transactionStorePromise = databaseReady.then(() =>
  createTransactionStore(databaseConnection),
);
const runGmailImportJob = createGmailImportJobRunner({
  bankDirectoryStorePromise,
  importJobStorePromise,
  importJobTransactionStorePromise,
  refreshTokenStorePromise,
  transactionStorePromise,
  scheduleRetry: (jobId, googleSubject, delayMs) => {
    void enqueueGmailImportJob(jobId, googleSubject, delayMs);
  },
});

const maxConcurrentImports = 2;
const pendingImportJobs: Array<{ id: string; googleSubject: string }> = [];
let activeImportCount = 0;

function enqueueGmailImportJob(id: string, googleSubject: string, delayMs = 0): Promise<void> {
  if (delayMs > 0) {
    setTimeout(() => enqueueGmailImportJob(id, googleSubject), delayMs);
    return Promise.resolve();
  }

  pendingImportJobs.push({ id, googleSubject });
  void drainGmailImportQueue();
  return Promise.resolve();
}

async function drainGmailImportQueue() {
  while (activeImportCount < maxConcurrentImports && pendingImportJobs.length > 0) {
    const nextJob = pendingImportJobs.shift();
    if (!nextJob) return;

    activeImportCount += 1;
    void runGmailImportJob(nextJob.id, nextJob.googleSubject).finally(() => {
      activeImportCount -= 1;
      void drainGmailImportQueue();
    });
  }
}

void databaseReady
  .then(async () => {
    const importJobStore = await importJobStorePromise;
    await importJobStore.requeueRunning();
    const unfinishedJobs = await importJobStore.listUnfinished();

    unfinishedJobs.forEach((job) => {
      const delayMs = job.nextAttemptAt
        ? Math.max(0, Date.parse(job.nextAttemptAt) - Date.now())
        : 0;
      void enqueueGmailImportJob(job.id, job.googleSubject, delayMs);
    });
  })
  .catch((error: unknown) => {
    console.error("Could not resume unfinished Gmail import jobs:", error);
  });

app.use(createHealthRouter());
app.use(createBankRouter({ bankDirectoryStorePromise }));
app.use(
  createAuthRouter({
    refreshTokenStorePromise,
    sessionStorePromise,
  }),
);
app.use(
  createImportRouter({
    bankDirectoryStorePromise,
    refreshTokenStorePromise,
    sessionStorePromise,
    importJobStorePromise,
    transactionStorePromise,
    runGmailImportJob: enqueueGmailImportJob,
  }),
);

const server = app.listen(appConfig.port, () => {
  console.log(`Account Manager backend listening on http://localhost:${appConfig.port}`);
});

function closeHttpServer(httpServer: Server) {
  return new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

let shutdownPromise: Promise<void> | null = null;

function shutdown(signal: NodeJS.Signals) {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    console.log(`Received ${signal}; shutting down Account Manager backend.`);

    try {
      await closeHttpServer(server);
      await databaseConnection.close();
    } catch {
      console.error("Backend shutdown did not complete cleanly.");
      process.exitCode = 1;
    }
  })();

  return shutdownPromise;
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
