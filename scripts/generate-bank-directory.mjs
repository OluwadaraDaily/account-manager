import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = resolve(rootDirectory, "scripts/bank-directory-seed.json");
const outputPath = resolve(rootDirectory, "data/banks.json");
const shouldFetchSources = process.argv.includes("--fetch");

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => value.toLowerCase()))].sort();
}

function sourceMatchesOfficialDomain(sourceUrl, domains) {
  const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function extractEmails(html) {
  return unique(html.match(emailPattern) ?? []);
}

async function discoverEmails(bank) {
  if (!shouldFetchSources) return [];

  const discoveredEmails = [];

  for (const source of bank.contactSources) {
    if (!sourceMatchesOfficialDomain(source.url, bank.officialDomains)) {
      console.warn(`Skipping non-official contact source for ${bank.displayName}.`);
      continue;
    }

    try {
      const response = await fetch(source.url, {
        headers: { "User-Agent": "AccountManagerBankDirectory/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      discoveredEmails.push(...extractEmails(html));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn(`Could not fetch ${source.url}: ${message}`);
    }
  }

  return discoveredEmails;
}

const seed = JSON.parse(await readFile(seedPath, "utf8"));
const checkedAt = shouldFetchSources ? new Date().toISOString() : null;
const banks = [];

for (const bank of seed.banks) {
  const discoveredEmails = await discoverEmails(bank);
  const customerServiceEmails = unique([...bank.customerServiceEmails]);

  banks.push({
    id: bank.id,
    displayName: bank.displayName,
    legalName: bank.legalName,
    aliases: bank.aliases,
    licenceCategory: bank.licenceCategory,
    officialDomains: bank.officialDomains,
    customerServiceEmails,
    candidateContactEmails: discoveredEmails,
    transactionNotificationSenderEmails: [],
    searchTerms: unique([bank.displayName, ...bank.aliases]),
    status: bank.status ?? "needs-review",
    verificationStatus: "needs-review",
    sources: [
      ...seed.regulatorySources
        .filter((source) => bank.status === "inactive" || source.name.includes("List of Deposit"))
        .map((source) => ({ type: "regulatory", ...source })),
      ...bank.contactSources.map((source) => ({ type: "contact", ...source })),
    ],
    checkedAt,
  });
}

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: seed.scope,
  banks,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated ${banks.length} bank records at ${outputPath}.`);
