import { createDatabaseConnection, type DatabaseConnection } from "../database.js";
import { createSqliteDatabase, type SqliteDatabase } from "../sqlite.js";
import type { PostgresPool } from "../postgres.js";

export type BankDirectorySeedRecord = {
  id: string;
  displayName: string;
  legalName: string;
  aliases: string[];
  licenceCategory: string;
  officialDomains: string[];
  customerServiceEmails: string[];
  candidateContactEmails: string[];
  transactionNotificationSenderEmail: string | null;
  searchTerms: string[];
  status: string;
  verificationStatus: string;
  sources: unknown[];
  checkedAt: string | null;
};

export type BankDirectoryRecord = BankDirectorySeedRecord & {
  createdAt: string;
  updatedAt: string;
};

export interface BankDirectoryStore {
  upsert(record: BankDirectorySeedRecord): Promise<BankDirectoryRecord>;
  get(bankId: string): Promise<BankDirectoryRecord | null>;
  list(): Promise<BankDirectoryRecord[]>;
  setTransactionNotificationSender(
    bankId: string,
    senderEmail: string,
  ): Promise<BankDirectoryRecord | null>;
  close(): Promise<void>;
}

type BankDirectoryRow = {
  bank_id: string;
  display_name: string;
  legal_name: string;
  aliases_json: string;
  licence_category: string;
  official_domains_json: string;
  customer_service_emails_json: string;
  candidate_contact_emails_json: string;
  transaction_notification_sender_email: string | null;
  search_terms_json: string;
  status: string;
  verification_status: string;
  sources_json: string;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(value: string) {
  return JSON.parse(value) as T;
}

function toBankDirectoryRecord(row: BankDirectoryRow): BankDirectoryRecord {
  return {
    id: row.bank_id,
    displayName: row.display_name,
    legalName: row.legal_name,
    aliases: parseJson<string[]>(row.aliases_json),
    licenceCategory: row.licence_category,
    officialDomains: parseJson<string[]>(row.official_domains_json),
    customerServiceEmails: parseJson<string[]>(row.customer_service_emails_json),
    candidateContactEmails: parseJson<string[]>(row.candidate_contact_emails_json),
    transactionNotificationSenderEmail: row.transaction_notification_sender_email,
    searchTerms: parseJson<string[]>(row.search_terms_json),
    status: row.status,
    verificationStatus: row.verification_status,
    sources: parseJson<unknown[]>(row.sources_json),
    checkedAt: row.checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getColumns() {
  return `
    bank_id, display_name, legal_name, aliases_json, licence_category,
    official_domains_json, customer_service_emails_json, candidate_contact_emails_json,
    transaction_notification_sender_email, search_terms_json, status, verification_status,
    sources_json, checked_at, created_at, updated_at`;
}

function getValues(record: BankDirectorySeedRecord) {
  return [
    record.id,
    record.displayName,
    record.legalName,
    JSON.stringify(record.aliases),
    record.licenceCategory,
    JSON.stringify(record.officialDomains),
    JSON.stringify(record.customerServiceEmails),
    JSON.stringify(record.candidateContactEmails),
    record.transactionNotificationSenderEmail,
    JSON.stringify(record.searchTerms),
    record.status,
    record.verificationStatus,
    JSON.stringify(record.sources),
    record.checkedAt,
  ];
}

export class SqliteBankDirectoryStore implements BankDirectoryStore {
  constructor(
    private readonly database: SqliteDatabase = createSqliteDatabase(),
    private readonly ownsDatabase = true,
  ) {}

  async upsert(record: BankDirectorySeedRecord) {
    const now = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO bank_directory
          (${getColumns()})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(bank_id) DO UPDATE SET
           display_name = excluded.display_name,
           legal_name = excluded.legal_name,
           aliases_json = excluded.aliases_json,
           licence_category = excluded.licence_category,
           official_domains_json = excluded.official_domains_json,
           customer_service_emails_json = excluded.customer_service_emails_json,
           candidate_contact_emails_json = excluded.candidate_contact_emails_json,
           transaction_notification_sender_email = COALESCE(
             bank_directory.transaction_notification_sender_email,
             excluded.transaction_notification_sender_email
           ),
           search_terms_json = excluded.search_terms_json,
           status = excluded.status,
           verification_status = excluded.verification_status,
           sources_json = excluded.sources_json,
           checked_at = excluded.checked_at,
           updated_at = excluded.updated_at`,
      )
      .run(...getValues(record), now, now);

    return (await this.get(record.id)) as BankDirectoryRecord;
  }

  async get(bankId: string) {
    const row = this.database
      .prepare(`SELECT ${getColumns()} FROM bank_directory WHERE bank_id = ?`)
      .get(bankId) as BankDirectoryRow | undefined;

    return row ? toBankDirectoryRecord(row) : null;
  }

  async list() {
    const rows = this.database
      .prepare(`SELECT ${getColumns()} FROM bank_directory ORDER BY display_name`)
      .all() as BankDirectoryRow[];

    return rows.map(toBankDirectoryRecord);
  }

  async setTransactionNotificationSender(bankId: string, senderEmail: string) {
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        `UPDATE bank_directory
         SET transaction_notification_sender_email = ?, updated_at = ?
         WHERE bank_id = ?`,
      )
      .run(senderEmail, now, bankId);

    return result.changes === 0 ? null : this.get(bankId);
  }

  async close() {
    if (this.ownsDatabase) this.database.close();
  }
}

export class PostgresBankDirectoryStore implements BankDirectoryStore {
  constructor(
    private readonly pool: PostgresPool,
    private readonly ownsPool = true,
  ) {}

  async upsert(record: BankDirectorySeedRecord) {
    const now = new Date().toISOString();
    const result = await this.pool.query<BankDirectoryRow>(
      `INSERT INTO bank_directory
        (${getColumns()})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (bank_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         legal_name = EXCLUDED.legal_name,
         aliases_json = EXCLUDED.aliases_json,
         licence_category = EXCLUDED.licence_category,
         official_domains_json = EXCLUDED.official_domains_json,
         customer_service_emails_json = EXCLUDED.customer_service_emails_json,
         candidate_contact_emails_json = EXCLUDED.candidate_contact_emails_json,
         transaction_notification_sender_email = COALESCE(
           bank_directory.transaction_notification_sender_email,
           EXCLUDED.transaction_notification_sender_email
         ),
         search_terms_json = EXCLUDED.search_terms_json,
         status = EXCLUDED.status,
         verification_status = EXCLUDED.verification_status,
         sources_json = EXCLUDED.sources_json,
         checked_at = EXCLUDED.checked_at,
         updated_at = EXCLUDED.updated_at
       RETURNING ${getColumns()}`,
      [...getValues(record), now, now],
    );

    return toBankDirectoryRecord(result.rows[0]);
  }

  async get(bankId: string) {
    const result = await this.pool.query<BankDirectoryRow>(
      `SELECT ${getColumns()} FROM bank_directory WHERE bank_id = $1`,
      [bankId],
    );

    return result.rows[0] ? toBankDirectoryRecord(result.rows[0]) : null;
  }

  async list() {
    const result = await this.pool.query<BankDirectoryRow>(
      `SELECT ${getColumns()} FROM bank_directory ORDER BY display_name`,
    );

    return result.rows.map(toBankDirectoryRecord);
  }

  async setTransactionNotificationSender(bankId: string, senderEmail: string) {
    const result = await this.pool.query<BankDirectoryRow>(
      `UPDATE bank_directory
       SET transaction_notification_sender_email = $1, updated_at = NOW()
       WHERE bank_id = $2
       RETURNING ${getColumns()}`,
      [senderEmail, bankId],
    );

    return result.rows[0] ? toBankDirectoryRecord(result.rows[0]) : null;
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

export async function createBankDirectoryStore(
  connection?: DatabaseConnection,
): Promise<BankDirectoryStore> {
  const ownsConnection = !connection;
  const activeConnection = connection ?? createDatabaseConnection();

  if (activeConnection.dialect === "postgres") {
    return new PostgresBankDirectoryStore(activeConnection.pool, ownsConnection);
  }

  return new SqliteBankDirectoryStore(activeConnection.database, ownsConnection);
}
