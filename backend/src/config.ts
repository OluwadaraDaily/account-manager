import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env"),
});

export const appConfig = {
  port: Number(process.env.PORT ?? 8787),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5174",
  oauthStateCookieName: "account_manager_oauth_state",
  sessionCookieName: "account_manager_session",
  oauthStateLifetimeSeconds: 10 * 60,
  sessionLifetimeSeconds: 30 * 24 * 60 * 60,
  secureCookies: process.env.SESSION_COOKIE_SECURE === "true",
};
