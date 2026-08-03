import type { Server } from "node:http";
import { createApp } from "./app.js";
import { appConfig } from "./config.js";
import { createDatabaseConnection } from "./db/database.js";
import { createImportJobStore } from "./db/repositories/importJobStore.js";
import { initializeDatabase } from "./db/schema.js";
import { createRefreshTokenStore } from "./db/repositories/refreshTokenStore.js";
import { createSessionStore } from "./db/repositories/sessionStore.js";
import { createGmailImportJobRunner } from "./import/gmailImportJobRunner.js";
import { createAuthRouter } from "./routes/authRoutes.js";
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
const runGmailImportJob = createGmailImportJobRunner({
  importJobStorePromise,
  refreshTokenStorePromise,
});

app.use(createHealthRouter());
app.use(
  createAuthRouter({
    refreshTokenStorePromise,
    sessionStorePromise,
  }),
);
app.use(
  createImportRouter({
    refreshTokenStorePromise,
    sessionStorePromise,
    importJobStorePromise,
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
