import { randomUUID } from "node:crypto";
import express from "express";
import type { HealthResponse } from "@account-manager/shared";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5174";
const oauthStateCookieName = "account_manager_oauth_state";
const oauthStateLifetimeSeconds = 10 * 60;
const secureCookies = process.env.SESSION_COOKIE_SECURE === "true";

app.disable("x-powered-by");

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Vary", "Origin");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: "64kb" }));

function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secureCookies) attributes.push("Secure");
  return attributes.join("; ");
}

app.get("/auth/google/start", (_request, response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    response.status(503).json({ error: "Google authorization is not configured." });
    return;
  }

  const state = randomUUID();
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/gmail.readonly",
  );
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "consent");
  authorizationUrl.searchParams.set("state", state);

  response.setHeader(
    "Set-Cookie",
    serializeCookie(oauthStateCookieName, state, oauthStateLifetimeSeconds),
  );
  response.redirect(authorizationUrl.toString());
});

app.get("/health", (_request, response) => {
  const body: HealthResponse = {
    service: "account-manager-backend",
    status: "ok",
  };

  response.json(body);
});

app.listen(port, () => {
  console.log(`Account Manager backend listening on http://localhost:${port}`);
});
