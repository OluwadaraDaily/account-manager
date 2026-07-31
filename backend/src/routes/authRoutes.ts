import { Router } from "express";
import { appConfig } from "../config.js";
import { parseCookies, serializeCookie } from "../http/cookies.js";
import { redirectToFrontend } from "../http/redirects.js";
import {
  createGoogleAuthorizationRequest,
  exchangeGoogleAuthorizationCode,
  revokeGoogleRefreshToken,
  verifyGoogleIdentity,
} from "../integrations/google/googleOAuth.js";
import type { RefreshTokenStore } from "../db/repositories/refreshTokenStore.js";
import type { SessionStore } from "../db/repositories/sessionStore.js";
import { decryptToken, encryptToken } from "../tokenCrypto.js";

type AuthRouterDependencies = {
  refreshTokenStorePromise: Promise<RefreshTokenStore>;
  sessionStorePromise: Promise<SessionStore>;
};

export function createAuthRouter({
  refreshTokenStorePromise,
  sessionStorePromise,
}: AuthRouterDependencies) {
  const router = Router();

  router.get("/auth/google/start", (_request, response) => {
    const authorizationRequest = createGoogleAuthorizationRequest();

    if (!authorizationRequest) {
      redirectToFrontend(response, "error");
      return;
    }

    response.setHeader(
      "Set-Cookie",
      serializeCookie(
        appConfig.oauthStateCookieName,
        authorizationRequest.state,
        appConfig.oauthStateLifetimeSeconds,
      ),
    );
    response.redirect(authorizationRequest.url.toString());
  });

  router.get("/auth/google/callback", async (request, response) => {
    const cookies = parseCookies(request.headers.cookie);
    const state = typeof request.query.state === "string" ? request.query.state : null;
    const expectedState = cookies.get(appConfig.oauthStateCookieName);

    response.setHeader("Set-Cookie", serializeCookie(appConfig.oauthStateCookieName, "", 0));

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
      const tokens = await exchangeGoogleAuthorizationCode(code);
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
        new Date(Date.now() + appConfig.sessionLifetimeSeconds * 1000).toISOString(),
      );
      response.append(
        "Set-Cookie",
        serializeCookie(appConfig.sessionCookieName, sessionId, appConfig.sessionLifetimeSeconds),
      );

      redirectToFrontend(response, "connected");
    } catch {
      console.error("Google authorization code exchange failed.");
      redirectToFrontend(response, "error");
    }
  });

  router.get("/auth/session", async (request, response) => {
    const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
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

  router.post("/auth/logout", async (request, response) => {
    const origin = request.get("origin");
    if (origin && origin !== appConfig.frontendOrigin) {
      response.status(403).json({ error: "Origin is not allowed." });
      return;
    }

    const sessionId = parseCookies(request.headers.cookie).get(appConfig.sessionCookieName);
    if (sessionId) {
      const sessionStore = await sessionStorePromise;
      const refreshTokenStore = await refreshTokenStorePromise;
      const account = await sessionStore.get(sessionId);

      if (account) {
        try {
          const encryptedToken = await refreshTokenStore.get(account);
          if (encryptedToken) await revokeGoogleRefreshToken(decryptToken(encryptedToken));
        } catch {
          console.warn("Google token revocation failed; local credentials will still be deleted.");
        } finally {
          await refreshTokenStore.delete(account);
        }
      }

      await sessionStore.delete(sessionId);
    }

    response.setHeader("Set-Cookie", serializeCookie(appConfig.sessionCookieName, "", 0));
    response.status(204).end();
  });

  return router;
}
