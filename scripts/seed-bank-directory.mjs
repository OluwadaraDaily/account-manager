import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(rootDirectory, "data/banks.json");

const { createDatabaseConnection } = await import("../backend/dist/db/database.js");
const { createBankDirectoryStore } =
  await import("../backend/dist/db/repositories/bankDirectoryStore.js");
const { initializeDatabase } = await import("../backend/dist/db/schema.js");

const directory = JSON.parse(await readFile(sourcePath, "utf8"));
const connection = createDatabaseConnection();

try {
  await initializeDatabase(connection);
  const store = await createBankDirectoryStore(connection);

  for (const bank of directory.banks) {
    await store.upsert({
      id: bank.id,
      displayName: bank.displayName,
      legalName: bank.legalName,
      aliases: bank.aliases,
      licenceCategory: bank.licenceCategory,
      officialDomains: bank.officialDomains,
      customerServiceEmails: bank.customerServiceEmails,
      candidateContactEmails: bank.candidateContactEmails,
      transactionNotificationSenderEmail: bank.transactionNotificationSenderEmails[0] ?? null,
      searchTerms: bank.searchTerms,
      status: bank.status,
      verificationStatus: bank.verificationStatus,
      sources: bank.sources,
      checkedAt: bank.checkedAt,
    });
  }

  console.log(`Seeded ${directory.banks.length} bank records into the database.`);
} finally {
  await connection.close();
}
