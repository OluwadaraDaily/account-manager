import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { Pool } from "pg";
import type { GoogleAccount } from "./refreshTokenStore.js";

export interface SessionStore {
  create(account: GoogleAccount, expiresAt: string): Promise<string>;
  get(sessionId: string): Promise<GoogleAccount | null>;
  delete(sessionId: string): Promise<void>;
  close(): Promise<void>;
}

type SessionRow = {
  google_subject: string;
  email: string | null;
  display_name: string | null;
};

const schema = `
  CREATE TABLE IF NOT EXISTS auth_sessions (
    session_hash TEXT PRIMARY KEY,
    google_subject TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  )
`;

function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

function createSessionId() {
  return randomBytes(32).toString("base64url");
}

function toAccount(row: SessionRow): GoogleAccount {
  return {
    googleSubject: row.google_subject,
    email: row.email,
    displayName: row.display_name,
  };
}

export class SqliteSessionStore implements SessionStore {
  private readonly database: Database.Database;

  constructor(databasePath = process.env.DATABASE_PATH ?? "./data/account-manager.sqlite") {
    const resolvedPath = databasePath === ":memory:" ? databasePath : resolve(databasePath);
    if (resolvedPath !== ":memory:") mkdirSync(dirname(resolvedPath), { recursive: true });

    this.database = new Database(resolvedPath);
    this.database.pragma("journal_mode = WAL");
    this.database.exec(schema.replaceAll("TIMESTAMPTZ", "TEXT"));
  }

  async create(account: GoogleAccount, expiresAt: string) {
    const sessionId = createSessionId();
    this.database
      .prepare(
        `INSERT INTO auth_sessions
          (session_hash, google_subject, email, display_name, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        hashSessionId(sessionId),
        account.googleSubject,
        account.email,
        account.displayName,
        expiresAt,
        new Date().toISOString(),
      );
    return sessionId;
  }

  async get(sessionId: string) {
    const row = this.database
      .prepare(
        `SELECT google_subject, email, display_name
         FROM auth_sessions
         WHERE session_hash = ? AND expires_at > ?`,
      )
      .get(hashSessionId(sessionId), new Date().toISOString()) as SessionRow | undefined;

    return row ? toAccount(row) : null;
  }

  async delete(sessionId: string) {
    this.database
      .prepare("DELETE FROM auth_sessions WHERE session_hash = ?")
      .run(hashSessionId(sessionId));
  }

  async close() {
    this.database.close();
  }
}

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly pool: Pool) {}

  async create(account: GoogleAccount, expiresAt: string) {
    const sessionId = createSessionId();
    await this.pool.query(
      `INSERT INTO auth_sessions
        (session_hash, google_subject, email, display_name, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        hashSessionId(sessionId),
        account.googleSubject,
        account.email,
        account.displayName,
        expiresAt,
      ],
    );
    return sessionId;
  }

  async get(sessionId: string) {
    const result = await this.pool.query<SessionRow>(
      `SELECT google_subject, email, display_name
       FROM auth_sessions
       WHERE session_hash = $1 AND expires_at > NOW()`,
      [hashSessionId(sessionId)],
    );

    return result.rows[0] ? toAccount(result.rows[0]) : null;
  }

  async delete(sessionId: string) {
    await this.pool.query("DELETE FROM auth_sessions WHERE session_hash = $1", [
      hashSessionId(sessionId),
    ]);
  }

  async close() {
    await this.pool.end();
  }
}

export async function createSessionStore(): Promise<SessionStore> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(schema);
    return new PostgresSessionStore(pool);
  }

  return new SqliteSessionStore();
}
