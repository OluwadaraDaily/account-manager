import { randomUUID } from "node:crypto";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import type { HealthResponse } from "@account-manager/shared";
import { createRefreshTokenStore } from "./refreshTokenStore.js";
import { createSessionStore } from "./sessionStore.js";
import { encryptToken } from "./tokenCrypto.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5174";
const oauthStateCookieName = "account_manager_oauth_state";
const sessionCookieName = "account_manager_session";
const oauthStateLifetimeSeconds = 10 * 60;
const sessionLifetimeSeconds = 30 * 24 * 60 * 60;
const secureCookies = process.env.SESSION_COOKIE_SECURE === "true";
const refreshTokenStorePromise = createRefreshTokenStore();
const sessionStorePromise = createSessionStore();

app.disable("x-powered-by");

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

function redirectToFrontend(response: express.Response, status: "connected" | "error") {
  const target = new URL(frontendOrigin);
  target.searchParams.set("gmail", status);
  response.redirect(target.toString());
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

  return {
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token ?? null,
  };
}

async function verifyGoogleIdentity(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured.");

  const ticket = await new OAuth2Client(clientId).verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error("Google identity did not include a subject.");

  return {
    googleSubject: payload.sub,
    email: payload.email ?? null,
    displayName: payload.name ?? null,
  };
}

app.get("/auth/google/start", (_request, response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    redirectToFrontend(response, "error");
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
    redirectToFrontend(response, "error");
    return;
  }

  if (typeof request.query.error === "string") {
    redirectToFrontend(response, "error");
    return;
  }

  const code = typeof request.query.code === "string" ? request.query.code : null;
  if (!code) {
    redirectToFrontend(response, "error");
    return;
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const account = await verifyGoogleIdentity(tokens.idToken);
    const refreshTokenStore = await refreshTokenStorePromise;
    const sessionStore = await sessionStorePromise;

    if (tokens.refreshToken) {
      await refreshTokenStore.save(account, encryptToken(tokens.refreshToken));
    } else if (!(await refreshTokenStore.has(account))) {
      throw new Error("Google did not return a refresh token for this account.");
    }

    const sessionId = await sessionStore.create(
      account,
      new Date(Date.now() + sessionLifetimeSeconds * 1000).toISOString(),
    );
    response.append(
      "Set-Cookie",
      serializeCookie(sessionCookieName, sessionId, sessionLifetimeSeconds),
    );

    redirectToFrontend(response, "connected");
  } catch (error) {
    console.error(
      "Google authorization code exchange failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    redirectToFrontend(response, "error");
  }
});

app.get("/auth/session", async (request, response) => {
  const sessionId = parseCookies(request.headers.cookie).get(sessionCookieName);
  const sessionStore = await sessionStorePromise;
  const account = sessionId ? await sessionStore.get(sessionId) : null;

  if (!account) {
    response.json({ authenticated: false });
    return;
  }

  response.json({
    authenticated: true,
    user: { email: account.email, displayName: account.displayName },
  });
});

app.post("/auth/logout", async (request, response) => {
  const origin = request.get("origin");
  if (origin && origin !== frontendOrigin) {
    response.status(403).json({ error: "Origin is not allowed." });
    return;
  }

  const sessionId = parseCookies(request.headers.cookie).get(sessionCookieName);
  if (sessionId) {
    const sessionStore = await sessionStorePromise;
    await sessionStore.delete(sessionId);
  }

  response.setHeader("Set-Cookie", serializeCookie(sessionCookieName, "", 0));
  response.status(204).end();
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
