import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = resolve(rootDirectory, "backend/test/fixtures");
process.env.DATABASE_PATH = resolve(rootDirectory, "backend/data/account-manager.sqlite");

const { createDatabaseConnection } = await import("../backend/dist/db/database.js");
const { initializeDatabase } = await import("../backend/dist/db/schema.js");
const { createRefreshTokenStore } =
  await import("../backend/dist/db/repositories/refreshTokenStore.js");
const { decryptToken } = await import("../backend/dist/security/encryption.js");
const { getGmailMessageContent, listGmailMessages } =
  await import("../backend/dist/integrations/google/gmailClient.js");
const { parseUnionBankTransaction } = await import("../backend/dist/parsers/unionBankParser.js");

const query =
  process.env.UNION_BANK_GMAIL_QUERY ?? 'newer_than:2y {from:unionbankng.com "Union Bank"}';

function redactAdjacentValues(body) {
  const lines = body.split("\n");
  const accountLabels = ["account no", "account number", "acct no", "acct number", "nuban"];
  const dateLabels = ["transaction date & time", "transaction date", "value date", "date"];
  const descriptionLabels = [
    "transaction description",
    "beneficiary",
    "recipient",
    "merchant",
    "counterparty",
    "sender",
    "narration",
    "description",
    "details",
    "remarks",
  ];

  for (let index = 0; index < lines.length - 1; index += 1) {
    const label = lines[index].trim().toLowerCase();
    if (accountLabels.includes(label)) lines[index + 1] = "[ACCOUNT]";
    if (dateLabels.includes(label)) lines[index + 1] = "01-Feb-2026 12:00";
    if (descriptionLabels.includes(label)) lines[index + 1] = "POS example transaction";
  }

  return lines.join("\n");
}

function redactBody(body) {
  const safeAmount = "NGN 12,345.67";
  let redacted = redactAdjacentValues(body)
    .replaceAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replaceAll(/(?:\+?234|0)\d[\d\s-]{8,}\d/g, "[PHONE]")
    .replaceAll(
      /((?:transaction date|value date|date)\s*[:=-]\s*)\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/gi,
      "$1 01/02/2026",
    )
    .replaceAll(/(?:NGN|₦|Naira)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/gi, safeAmount)
    .replaceAll(
      /\b(?:account|acct|nuban)(?:\s+number|\s+no\.?|\s*#)?\s*[:=-]?\s*\d{6,}\b/gi,
      "Account: [ACCOUNT]",
    )
    .replaceAll(
      /(\b(?:beneficiary|recipient|merchant|counterparty|sender|customer name|name)\s*[:=-]\s*)[^\r\n]+/gi,
      "$1[REDACTED]",
    )
    .replaceAll(
      /(\b(?:narration|description|details|remarks)\s*[:=-]\s*)[^\r\n]+/gi,
      "$1Example transaction",
    )
    .replaceAll(/\b\d{8,}\b/g, "[NUMBER]")
    .replaceAll(/\b(?:dear|hello|hi)\s+[^,\r\n]+/gi, "Hello Customer");

  return `${redacted.trim()}\n`;
}

function classifyMessage(message) {
  const parsed = parseUnionBankTransaction(message);
  if (parsed?.direction) return parsed.direction;

  const text = `${message.headers.subject ?? ""}\n${message.body.text ?? ""}`;
  const debit = /\b(debit(?:ed)?|withdrawn|purchase|payment)\b/i.test(text);
  const credit = /\b(credit(?:ed)?|deposit|received)\b/i.test(text);
  return debit === credit ? null : debit ? "debit" : "credit";
}

const connection = createDatabaseConnection();

try {
  await initializeDatabase(connection);

  if (connection.dialect !== "sqlite") {
    throw new Error("This one-time local capture utility currently supports SQLite only.");
  }

  const accountRow = connection.database
    .prepare(
      "SELECT google_subject, email, display_name FROM google_refresh_tokens ORDER BY updated_at DESC LIMIT 1",
    )
    .get();

  if (!accountRow) throw new Error("No connected Gmail account was found.");

  const account = {
    googleSubject: accountRow.google_subject,
    email: accountRow.email,
    displayName: accountRow.display_name,
  };
  const refreshTokenStore = await createRefreshTokenStore(connection);
  const encryptedToken = await refreshTokenStore.get(account);

  if (!encryptedToken) throw new Error("The connected Gmail refresh token was not found.");

  const references = await listGmailMessages({
    refreshToken: decryptToken(encryptedToken),
    q: query,
  });

  await mkdir(fixtureDirectory, { recursive: true });
  const captured = new Set();

  for (const reference of references.messages) {
    if (captured.size === 2) break;

    const message = await getGmailMessageContent({
      refreshToken: decryptToken(encryptedToken),
      messageId: reference.id,
    });
    const direction = classifyMessage(message);
    if (!direction || !message.body.text || captured.has(direction)) continue;

    const path = resolve(fixtureDirectory, `union-bank-${direction}-redacted.txt`);
    await writeFile(path, redactBody(message.body.text), "utf8");
    captured.add(direction);
    console.log(`Captured redacted ${direction} fixture.`);
  }

  if (captured.size < 2) {
    throw new Error(
      `Only captured ${captured.size} of 2 fixture types. Try UNION_BANK_GMAIL_QUERY with a narrower or different Gmail query.`,
    );
  }

  console.log("Raw message bodies were not printed or written.");
} finally {
  await connection.close();
}
