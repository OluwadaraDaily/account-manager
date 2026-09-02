import type { NormalizedTransaction } from "@account-manager/shared";
import type { GmailMessageContent } from "../../integrations/google/gmailClient.js";
import { assessTransaction, fallbackMessageDate, fallbackMessageTime } from "../shared/utils.js";
import { getAccessFields } from "./utils.js";

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
  )
    return null;

  const fields = getAccessFields(bodyText, subject);
  const transactionDate = fields.parsedTransactionDate ?? fallbackMessageDate(message);
  const reviewReasons: string[] = [];
  if (fields.hasReversalOrRefundSignal) reviewReasons.push("possible_reversal_or_refund");
  const { confidence, reviewStatus } = assessTransaction({
    amount: fields.amount,
    direction: fields.direction,
    parsedTransactionDate: fields.parsedTransactionDate,
    transactionDate,
    reviewReasons,
  });

  return {
    sourceMessageId: message.id,
    transactionDate,
    transactionTime: fallbackMessageTime(message),
    direction: fields.direction,
    amount: fields.amount,
    currency: fields.amount ? "NGN" : null,
    counterparty: null,
    description: fields.description ?? (subject || null),
    channel: fields.channel,
    confidence,
    reviewReasons,
    reviewStatus,
  };
}
