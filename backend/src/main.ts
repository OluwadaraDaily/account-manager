import { createApp } from "./app.js";
import { appConfig } from "./config.js";
import { createDatabaseConnection } from "./db/database.js";
import { initializeDatabase } from "./db/schema.js";
import { createRefreshTokenStore } from "./refreshTokenStore.js";
import { createSessionStore } from "./sessionStore.js";
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
  }),
);

app.listen(appConfig.port, () => {
  console.log(`Account Manager backend listening on http://localhost:${appConfig.port}`);
});
