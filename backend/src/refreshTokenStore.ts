import { createDatabaseConnection } from "./db/database.js";
import { createSqliteDatabase, type SqliteDatabase } from "./db/sqlite.js";
import type { PostgresPool } from "./db/postgres.js";
import type { EncryptedToken } from "./tokenCrypto.js";

export type GoogleAccount = {
  googleSubject: string;
  email: string | null;
  displayName: string | null;
};

type TokenRow = {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
};

export interface RefreshTokenStore {
  save(account: GoogleAccount, encryptedToken: EncryptedToken): Promise<void>;
  has(account: Pick<GoogleAccount, "googleSubject">): Promise<boolean>;
  get(account: Pick<GoogleAccount, "googleSubject">): Promise<EncryptedToken | null>;
  delete(account: Pick<GoogleAccount, "googleSubject">): Promise<void>;
  close(): Promise<void>;
}

const postgresSchema = `
  CREATE TABLE IF NOT EXISTS google_refresh_tokens (
    google_subject TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )
`;

function toEncryptedToken(row: TokenRow): EncryptedToken {
  return {
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.auth_tag,
    keyVersion: row.key_version,
  };
}

export class SqliteRefreshTokenStore implements RefreshTokenStore {
  private readonly database: SqliteDatabase;

  constructor(database: SqliteDatabase = createSqliteDatabase()) {
    this.database = database;
    this.database.exec(postgresSchema.replaceAll("TIMESTAMPTZ", "TEXT"));
  }

  async save(account: GoogleAccount, encryptedToken: EncryptedToken) {
    const now = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO google_refresh_tokens
          (google_subject, email, display_name, ciphertext, iv, auth_tag, key_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(google_subject) DO UPDATE SET email = excluded.email,
           display_name = excluded.display_name, ciphertext = excluded.ciphertext,
           iv = excluded.iv, auth_tag = excluded.auth_tag, key_version = excluded.key_version,
           updated_at = excluded.updated_at`,
      )
      .run(
        account.googleSubject,
        account.email,
        account.displayName,
        encryptedToken.ciphertext,
        encryptedToken.iv,
        encryptedToken.authTag,
        encryptedToken.keyVersion,
        now,
        now,
      );
  }

  async has(account: Pick<GoogleAccount, "googleSubject">) {
    const row = this.database
      .prepare("SELECT 1 AS present FROM google_refresh_tokens WHERE google_subject = ?")
      .get(account.googleSubject) as { present: number } | undefined;
    return Boolean(row?.present);
  }

  async get(account: Pick<GoogleAccount, "googleSubject">) {
    const row = this.database
      .prepare(
        "SELECT ciphertext, iv, auth_tag, key_version FROM google_refresh_tokens WHERE google_subject = ?",
      )
      .get(account.googleSubject) as TokenRow | undefined;

    return row ? toEncryptedToken(row) : null;
  }

  async delete(account: Pick<GoogleAccount, "googleSubject">) {
    this.database
      .prepare("DELETE FROM google_refresh_tokens WHERE google_subject = ?")
      .run(account.googleSubject);
  }

  async close() {
    this.database.close();
  }
}

export class PostgresRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly pool: PostgresPool) {}

  async save(account: GoogleAccount, encryptedToken: EncryptedToken) {
    await this.pool.query(
      `INSERT INTO google_refresh_tokens
        (google_subject, email, display_name, ciphertext, iv, auth_tag, key_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (google_subject) DO UPDATE SET email = EXCLUDED.email,
         display_name = EXCLUDED.display_name, ciphertext = EXCLUDED.ciphertext,
         iv = EXCLUDED.iv, auth_tag = EXCLUDED.auth_tag, key_version = EXCLUDED.key_version,
         updated_at = NOW()`,
      [
        account.googleSubject,
        account.email,
        account.displayName,
        encryptedToken.ciphertext,
        encryptedToken.iv,
        encryptedToken.authTag,
        encryptedToken.keyVersion,
      ],
    );
  }

  async has(account: Pick<GoogleAccount, "googleSubject">) {
    const result = await this.pool.query(
      "SELECT 1 FROM google_refresh_tokens WHERE google_subject = $1",
      [account.googleSubject],
    );
    return result.rowCount !== 0;
  }

  async get(account: Pick<GoogleAccount, "googleSubject">) {
    const result = await this.pool.query<TokenRow>(
      "SELECT ciphertext, iv, auth_tag, key_version FROM google_refresh_tokens WHERE google_subject = $1",
      [account.googleSubject],
    );
    return result.rows[0] ? toEncryptedToken(result.rows[0]) : null;
  }

  async delete(account: Pick<GoogleAccount, "googleSubject">) {
    await this.pool.query("DELETE FROM google_refresh_tokens WHERE google_subject = $1", [
      account.googleSubject,
    ]);
  }

  async close() {
    await this.pool.end();
  }
}

export async function createRefreshTokenStore(): Promise<RefreshTokenStore> {
  const connection = createDatabaseConnection();

  if (connection.dialect === "postgres") {
    await connection.pool.query(postgresSchema);
    return new PostgresRefreshTokenStore(connection.pool);
  }

  return new SqliteRefreshTokenStore(connection.database);
}
