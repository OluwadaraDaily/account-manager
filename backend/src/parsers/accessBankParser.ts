import type { NormalizedTransaction } from "@account-manager/shared";
import type { GmailMessageContent } from "../integrations/google/gmailClient.js";
import {
  assessTransaction,
  fallbackMessageDate,
  normalizeAmount,
  parseDateValue,
} from "./parserUtils.js";

function nextValue(lines: string[], label: string) {
  const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  return index === -1 ? null : (lines.slice(index + 1).find(Boolean) ?? null);
}

export function parseAccessBankTransaction(
  message: GmailMessageContent,
): NormalizedTransaction | null {
  const bodyText = message.body.text ?? "";
  const subject = message.headers.subject ?? "";
  const from = message.headers.from ?? "";
  const searchableText = `${from}\n${subject}\n${bodyText}`;
  if (
    !/no_reply@accessbankplc\.com/i.test(from) ||
    !/accessalert|access bank/i.test(searchableText)
  ) {
    return null;
  }

  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const subjectDirection = subject.match(/\[(Debit|Credit):/i)?.[1]?.toLowerCase();
  const bodyDirectionMatch = searchableText
    .match(/account has been (Debited|Credited)/i)?.[1]
    ?.toLowerCase();
  const bodyDirection = bodyDirectionMatch?.startsWith("debit")
    ? "debit"
    : bodyDirectionMatch?.startsWith("credit")
      ? "credit"
      : undefined;
  const direction =
    subjectDirection === bodyDirection ? (subjectDirection as "debit" | "credit") : null;
  const amountSource =
    subject.match(/\[(?:Debit|Credit):\s*(?:NGN|₦)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:NGN)?/i)?.[1] ??
    bodyText.match(/(?:NGN|₦)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1] ??
    null;
  const amount = normalizeAmount(amountSource);
  const description = nextValue(lines, "Description");
  const transactionDateValue = nextValue(lines, "Transaction Date");
  const parsedTransactionDate = parseDateValue(transactionDateValue);
  const transactionDate = parsedTransactionDate ?? fallbackMessageDate(message);
  const reviewReasons: string[] = [];

  if (/\b(reversal|reversed|refund|chargeback|returned)\b/i.test(searchableText)) {
    reviewReasons.push("possible_reversal_or_refund");
  }
  const { confidence, reviewStatus } = assessTransaction({
    amount,
    direction,
    parsedTransactionDate,
    transactionDate,
    reviewReasons,
  });

  const channel =
    description?.match(/\b(WEB|MOBILE|POS|ATM|USSD|INTERNET)\b/i)?.[1]?.toUpperCase() ?? null;
  return {
    sourceMessageId: message.id,
    transactionDate,
    transactionTime: null,
    direction,
    amount,
    currency: amount ? "NGN" : null,
    counterparty: null,
    description: description ?? (subject || null),
    channel,
    confidence,
    reviewReasons,
    reviewStatus,
  };
}
