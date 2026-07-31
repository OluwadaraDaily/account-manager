# Account Manager backend

This directory contains the server-side OAuth, Gmail import, and asynchronous job code.

The current scaffold exposes only a typed health endpoint. OAuth, persistent sessions, Gmail
access, and background jobs will be added in later steps.

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

The backend may process Gmail content transiently during an active import, but it must not
persist raw messages, bodies, attachments, or unrelated bank data. It may persist only normalized
transactions extracted from banks explicitly selected by the user.
