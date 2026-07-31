import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { googleConfig } from "../../config.js";

export type GoogleAuthorizationRequest = {
  state: string;
  url: URL;
};

export function createGoogleAuthorizationRequest(): GoogleAuthorizationRequest | null {
  const { clientId, redirectUri } = googleConfig;

  if (!clientId || !redirectUri) return null;

  const state = randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/gmail.readonly",
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return { state, url };
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleConfig;

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

export async function verifyGoogleIdentity(idToken: string) {
  const { clientId } = googleConfig;
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

export async function revokeGoogleRefreshToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  });

  if (!response.ok && response.status !== 400) {
    throw new Error(`Google token revocation failed with status ${response.status}.`);
  }
}
