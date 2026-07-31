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

function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>();

  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}

async function exchangeAuthorizationCode(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth server configuration is incomplete.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with status ${response.status}.`);
  }

  const tokens = (await response.json()) as {
    access_token?: string;
    id_token?: string;
    refresh_token?: string;
  };

  if (!tokens.access_token || !tokens.id_token) {
    throw new Error("Google token exchange did not return the expected tokens.");
  }

  return { hasRefreshToken: Boolean(tokens.refresh_token) };
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

app.get("/auth/google/callback", async (request, response) => {
  const cookies = parseCookies(request.headers.cookie);
  const state = typeof request.query.state === "string" ? request.query.state : null;
  const expectedState = cookies.get(oauthStateCookieName);

  response.setHeader("Set-Cookie", serializeCookie(oauthStateCookieName, "", 0));

  if (!state || !expectedState || state !== expectedState) {
    response.status(400).json({ error: "OAuth state validation failed." });
    return;
  }

  if (typeof request.query.error === "string") {
    response.status(400).json({ error: "Google authorization was not completed." });
    return;
  }

  const code = typeof request.query.code === "string" ? request.query.code : null;
  if (!code) {
    response.status(400).json({ error: "Google did not return an authorization code." });
    return;
  }

  try {
    const result = await exchangeAuthorizationCode(code);
    response.json({
      status: "authorization_code_exchanged",
      refreshTokenReceived: result.hasRefreshToken,
      message: "The code was exchanged successfully. Tokens were not stored yet.",
    });
  } catch (error) {
    console.error(
      "Google authorization code exchange failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    response.status(502).json({ error: "Google authorization could not be completed." });
  }
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
