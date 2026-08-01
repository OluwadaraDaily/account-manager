import type { NormalizedTransaction } from "@account-manager/shared";
import type { GmailMessageContent } from "../integrations/google/gmailClient.js";

const fieldLabels = {
  amount: ["transaction amount", "debit amount", "credit amount", "amount"],
  counterparty: ["counterparty", "merchant", "beneficiary", "recipient", "sender"],
  description: ["narration", "description", "details", "remarks"],
  channel: ["channel", "transaction channel", "via"],
  date: ["transaction date", "value date", "date"],
};

function captureField(text: string, labels: string[]) {
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:${labels.join("|")})\\s*[:=-]\\s*([^\\n]+)`, "i");
  return text.match(pattern)?.[1]?.trim() || null;
}

function parseDateValue(value: string | null) {
  if (!value) return null;

  const isoMatch = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const numericMatch = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numericMatch) {
    const year =
      Number(numericMatch[3]) < 100 ? 2000 + Number(numericMatch[3]) : Number(numericMatch[3]);
    return toIsoDate(year, Number(numericMatch[2]), Number(numericMatch[1]));
  }

  const monthMatch = value.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (monthMatch) {
    const month =
      [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ].findIndex((name) => name.startsWith(monthMatch[2].toLowerCase())) + 1;
    return month ? toIsoDate(Number(monthMatch[3]), month, Number(monthMatch[1])) : null;
  }

  return null;
}

function toIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function fallbackMessageDate(message: GmailMessageContent) {
  if (message.internalDate) {
    const timestamp = Number(message.internalDate);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString().slice(0, 10);
  }

  if (message.headers.date) {
    const date = new Date(message.headers.date);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  return null;
}

function parseAmount(text: string) {
  const labeledValue = captureField(text, fieldLabels.amount);
  const amountSource =
    labeledValue ?? text.match(/(?:NGN|₦|Naira)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i)?.[0] ?? null;
  if (!amountSource) return null;

  const amount = amountSource.match(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/);
  return amount ? amount[0].replaceAll(",", "") : null;
}

export function parseUnionBankTransaction(
  message: GmailMessageContent,
): NormalizedTransaction | null {
  const bodyText = message.body.text ?? "";
  const subject = message.headers.subject ?? "";
  const from = message.headers.from ?? "";
  const searchableText = `${from}\n${subject}\n${bodyText}`;

  const isUnionBankMessage = /unionbankng\.com/i.test(from) || /\bunion\s+bank\b/i.test(subject);
  const hasTransactionSignal =
    /\b(transaction|debit(?:ed)?|credit(?:ed)?|amount|narration|balance)\b/i.test(bodyText);
  if (!isUnionBankMessage || !hasTransactionSignal) return null;

  const hasDebitSignal = /\b(debit(?:ed)?|withdrawn|purchase|payment)\b/i.test(searchableText);
  const hasCreditSignal = /\b(credit(?:ed)?|deposit|received)\b/i.test(searchableText);
  const direction = hasDebitSignal === hasCreditSignal ? null : hasDebitSignal ? "debit" : "credit";
  const amount = parseAmount(bodyText);
  const transactionDate =
    parseDateValue(captureField(bodyText, fieldLabels.date)) ?? fallbackMessageDate(message);

  return {
    sourceMessageId: message.id,
    transactionDate,
    direction,
    amount,
    currency: amount ? "NGN" : null,
    counterparty: captureField(bodyText, fieldLabels.counterparty),
    description: captureField(bodyText, fieldLabels.description) ?? (subject || null),
    channel: captureField(bodyText, fieldLabels.channel),
  };
}
