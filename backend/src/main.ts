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
});

void databaseReady
  .then(async () => {
    const importJobStore = await importJobStorePromise;
    const unfinishedJobs = await importJobStore.listUnfinished();

    await Promise.all(
      unfinishedJobs.map((job) => runGmailImportJob(job.id, job.googleSubject)),
    );
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
    runGmailImportJob,
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
