import { normalizeAmount, parseDateValue } from "../shared/utils.js";

function nextValue(lines: string[], label: string) {
  const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  return index === -1 ? null : (lines.slice(index + 1).find(Boolean) ?? null);
}

export function getAccessFields(bodyText: string, subject: string) {
  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const subjectDirection = subject.match(/\[(Debit|Credit):/i)?.[1]?.toLowerCase();
  const bodyDirectionMatch = bodyText
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
  const description = nextValue(lines, "Description");
  const transactionDateValue = nextValue(lines, "Transaction Date");
  return {
    direction,
    amount: normalizeAmount(amountSource),
    description,
    parsedTransactionDate: parseDateValue(transactionDateValue),
    channel:
      description?.match(/\b(WEB|MOBILE|POS|ATM|USSD|INTERNET)\b/i)?.[1]?.toUpperCase() ?? null,
    hasReversalOrRefundSignal: /\b(reversal|reversed|refund|chargeback|returned)\b/i.test(
      `${subject}\n${bodyText}`,
    ),
  };
}
