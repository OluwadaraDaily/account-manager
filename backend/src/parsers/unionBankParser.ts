import type { NormalizedTransaction } from "@account-manager/shared";
import type { GmailMessageContent } from "../integrations/google/gmailClient.js";
import {
  assessTransaction,
  fallbackMessageDate,
  normalizeAmount,
  parseDateValue,
  parseTimeValue,
} from "./parserUtils.js";

const fieldLabels = {
  amount: ["transaction amount", "debit amount", "credit amount", "amount"],
  counterparty: ["counterparty", "merchant", "beneficiary", "recipient", "sender"],
  description: ["transaction description", "narration", "description", "details", "remarks"],
  channel: ["channel", "transaction channel", "via"],
  date: ["transaction date & time", "transaction date", "value date", "date"],
  type: ["transaction type"],
};

function captureField(text: string, labels: string[]) {
  const pattern = new RegExp(
    `(?:^|\\n)[ \\t]*(?:${labels.join("|")})[ \\t]*[:=-][ \\t]*([^\\n]+)`,
    "i",
  );
  return text.match(pattern)?.[1]?.trim() || null;
}

function captureAdjacentField(text: string, labels: string[]) {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const allFieldLabels = Object.values(fieldLabels)
    .flat()
    .map((label) => label.toLowerCase());
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (!normalizedLabels.includes(lines[index].trim().toLowerCase())) continue;

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex].trim();
      if (!nextLine) continue;

      const nextLabel = nextLine
        .match(/^([^:=-]+)\s*[:=-]/)?.[1]
        ?.trim()
        .toLowerCase();
      if (nextLabel && allFieldLabels.includes(nextLabel)) return null;

      return nextLine;
    }
  }

  return null;
}

function parseAmount(text: string) {
  const labeledValue =
    captureField(text, fieldLabels.amount) ?? captureAdjacentField(text, fieldLabels.amount);
  const amountSource =
    labeledValue ?? text.match(/(?:NGN|₦|Naira)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i)?.[0] ?? null;
  if (!amountSource) return null;

  return normalizeAmount(amountSource);
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

  const amount = parseAmount(bodyText);
  const hasObviousNonTransactionSignal =
    /\b(newsletter|promotion(?:al)?|special offer|campaign|survey|feedback|banking tips|transaction summary|service update)\b/i.test(
      searchableText,
    );
  if (hasObviousNonTransactionSignal && !amount) return null;
  const hasReversalOrRefundSignal =
    /\b(reversal|reversed|reverted|refund(?:ed)?|chargeback|returned)\b/i.test(searchableText);

  const hasDebitSignal = /\b(debit(?:ed)?|withdrawn|purchase|payment)\b/i.test(searchableText);
  const hasCreditSignal = /\b(credit(?:ed)?|deposit|received)\b/i.test(searchableText);
  const transactionType =
    captureField(bodyText, fieldLabels.type) ?? captureAdjacentField(bodyText, fieldLabels.type);
  const hasDebitAlertSignal = /debitalert/i.test(transactionType ?? "");
  const hasCreditAlertSignal = /creditalert/i.test(transactionType ?? "");
  const debitSignal = hasDebitSignal || hasDebitAlertSignal;
  const creditSignal = hasCreditSignal || hasCreditAlertSignal;
  const direction = debitSignal === creditSignal ? null : debitSignal ? "debit" : "credit";
  const transactionDateValue =
    captureField(bodyText, fieldLabels.date) ?? captureAdjacentField(bodyText, fieldLabels.date);
  const parsedTransactionDate = parseDateValue(transactionDateValue);
  const transactionTime = parseTimeValue(transactionDateValue);
  const fallbackDate = fallbackMessageDate(message);
  const transactionDate = parsedTransactionDate ?? fallbackDate;
  const reviewReasons: string[] = [];

  if (!direction) {
    if (hasDebitSignal && hasCreditSignal) reviewReasons.push("conflicting_direction_signals");
  }
  if (hasReversalOrRefundSignal) reviewReasons.push("possible_reversal_or_refund");

  const { confidence, reviewStatus } = assessTransaction({
    amount,
    direction,
    parsedTransactionDate,
    transactionDate,
    reviewReasons,
  });

  return {
    sourceMessageId: message.id,
    transactionDate,
    transactionTime,
    direction,
    amount,
    currency: amount ? "NGN" : null,
    counterparty:
      captureField(bodyText, fieldLabels.counterparty) ??
      captureAdjacentField(bodyText, fieldLabels.counterparty),
    description:
      captureField(bodyText, fieldLabels.description) ??
      captureAdjacentField(bodyText, fieldLabels.description) ??
      (subject || null),
    channel:
      captureField(bodyText, fieldLabels.channel) ??
      captureAdjacentField(bodyText, fieldLabels.channel) ??
      bodyText.match(/\b(POS|ATM|USSD|mobile|internet)\b/i)?.[1]?.toUpperCase() ??
      null,
    confidence,
    reviewReasons,
    reviewStatus,
  };
}
