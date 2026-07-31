# Account Manager backend

This directory contains the server-side OAuth, Gmail import, and asynchronous job code.

The backend exposes a typed health endpoint and the server-side OAuth/session foundation. Gmail
retrieval and background import jobs are still planned work.

## OAuth redirect configuration

The Google OAuth web client must allow the backend callback URI, not the frontend URL. Add these
entries under **Authorized redirect URIs** in Google Cloud Console:

- Development: `http://localhost:8787/auth/google/callback`
- Production: `https://<production-backend-domain>/auth/google/callback`

Replace `<production-backend-domain>` with the real HTTPS hostname when the backend is deployed.
The production value must exactly match `GOOGLE_REDIRECT_URI`, including the scheme, host, path,
and any trailing slash.

Copy `.env.example` to `.env` for local backend configuration. The OAuth client secret belongs in
the backend environment only and must never be placed in the frontend environment or committed.

## Authorization lifecycle

The user must be present for the initial authorization because Google displays the consent screen
and returns an authorization code to the backend callback. The backend exchanges that code, verifies
the Google identity, encrypts the refresh token, and creates a session cookie.

After the initial authorization, the stored refresh token can be used by backend import jobs after a
page reload or while the user is not actively viewing the app. The browser receives session status,
not Gmail access or refresh tokens.

Disconnect currently revokes Google access when possible, deletes the local encrypted credential, and
deletes the session. Normalized transaction persistence does not exist yet, so imported transaction
clearing will be completed together with that data store.

## Production secret and database controls

Production must use a private PostgreSQL instance through `DATABASE_URL`. The application database
role should have only the required table permissions, and the database must not be publicly exposed.
`TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, and `DATABASE_URL` belong in a managed secret store
with access limited to the backend service. They must not be committed or placed in frontend
configuration.

The backend may process Gmail content transiently during an active import, but it must not
persist raw messages, bodies, attachments, or unrelated bank data. It may persist only normalized
transactions extracted from banks explicitly selected by the user.
