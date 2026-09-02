import type { NormalizedTransaction } from "@account-manager/shared";
import type { GmailMessageContent } from "../../integrations/google/gmailClient.js";
import {
  assessTransaction,
  fallbackMessageDate,
  parseDateValue,
  parseTimeValue,
} from "../shared/utils.js";
import { captureAdjacentField, captureField, fieldLabels, parseUnionAmount } from "./utils.js";

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

  const amount = parseUnionAmount(bodyText);
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
  const debitSignal = hasDebitSignal || /debitalert/i.test(transactionType ?? "");
  const creditSignal = hasCreditSignal || /creditalert/i.test(transactionType ?? "");
  const direction = debitSignal === creditSignal ? null : debitSignal ? "debit" : "credit";
  const transactionDateValue =
    captureField(bodyText, fieldLabels.date) ?? captureAdjacentField(bodyText, fieldLabels.date);
  const parsedTransactionDate = parseDateValue(transactionDateValue);
  const transactionDate = parsedTransactionDate ?? fallbackMessageDate(message);
  const reviewReasons: string[] = [];
  if (!direction && hasDebitSignal && hasCreditSignal)
    reviewReasons.push("conflicting_direction_signals");
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
    transactionTime: parseTimeValue(transactionDateValue),
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
