# Account Manager

Account Manager imports bank transactions from Gmail, lets you review them, and exports the
results as CSV or XLSX.

## Setup

Requirements: Node.js and npm.

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Add your Google OAuth values to `backend/.env`. The OAuth callback URL for local development is:

```text
http://localhost:8787/auth/google/callback
```

## Run locally

Start the backend and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5174.

## Useful commands

```bash
npm run build          # Build all workspaces
npm run test:parser   # Run bank parser tests
npm run format:check  # Check formatting
```

## Project structure

- `frontend/` — React, Vite, Tailwind, and shadcn/ui interface.
- `backend/` — Express server, Google OAuth, Gmail imports, and data storage.
- `shared/` — Shared TypeScript types and API contracts.

The app stores normalized transaction data only. Raw Gmail messages and attachments are not stored.
