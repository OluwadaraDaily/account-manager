import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
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

export class SqliteRefreshTokenStore {
  private readonly database: Database.Database;

  constructor(databasePath = process.env.DATABASE_PATH ?? "./data/account-manager.sqlite") {
    const resolvedPath = databasePath === ":memory:" ? databasePath : resolve(databasePath);
    if (resolvedPath !== ":memory:") mkdirSync(dirname(resolvedPath), { recursive: true });

    this.database = new Database(resolvedPath);
    this.database.pragma("foreign_keys = ON");
    this.database.pragma("journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS google_refresh_tokens (
        google_subject TEXT PRIMARY KEY,
        email TEXT,
        display_name TEXT,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        key_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  save(account: GoogleAccount, encryptedToken: EncryptedToken) {
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

  has(account: Pick<GoogleAccount, "googleSubject">) {
    const row = this.database
      .prepare("SELECT 1 AS present FROM google_refresh_tokens WHERE google_subject = ?")
      .get(account.googleSubject) as { present: number } | undefined;
    return Boolean(row?.present);
  }

  get(account: Pick<GoogleAccount, "googleSubject">): EncryptedToken | null {
    const row = this.database
      .prepare(
        "SELECT ciphertext, iv, auth_tag, key_version FROM google_refresh_tokens WHERE google_subject = ?",
      )
      .get(account.googleSubject) as TokenRow | undefined;

    return row
      ? {
          ciphertext: row.ciphertext,
          iv: row.iv,
          authTag: row.auth_tag,
          keyVersion: row.key_version,
        }
      : null;
  }

  delete(account: Pick<GoogleAccount, "googleSubject">) {
    this.database
      .prepare("DELETE FROM google_refresh_tokens WHERE google_subject = ?")
      .run(account.googleSubject);
  }

  close() {
    this.database.close();
  }
}
