import { createHash, randomBytes } from "node:crypto";
import { createDatabaseConnection, type DatabaseConnection } from "../database.js";
import { createSqliteDatabase, type SqliteDatabase } from "../sqlite.js";
import type { PostgresPool } from "../postgres.js";
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
  private readonly database: SqliteDatabase;

  constructor(
    database: SqliteDatabase = createSqliteDatabase(),
    private readonly ownsDatabase = true,
  ) {
    this.database = database;
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
    if (this.ownsDatabase) this.database.close();
  }
}

export class PostgresSessionStore implements SessionStore {
  constructor(
    private readonly pool: PostgresPool,
    private readonly ownsPool = true,
  ) {}

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
    if (this.ownsPool) await this.pool.end();
  }
}

export async function createSessionStore(connection?: DatabaseConnection): Promise<SessionStore> {
  const ownsConnection = !connection;
  const activeConnection = connection ?? createDatabaseConnection();

  if (activeConnection.dialect === "postgres") {
    return new PostgresSessionStore(activeConnection.pool, ownsConnection);
  }

  return new SqliteSessionStore(activeConnection.database, ownsConnection);
}
