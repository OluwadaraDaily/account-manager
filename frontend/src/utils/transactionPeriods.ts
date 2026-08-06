import type { Transaction } from "../types/transaction";

const periodDays: Record<string, number> = {
  "Last 7 days": 7,
  "Last 30 days": 30,
  "Last 365 days": 365,
};

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: string,
  today = new Date(),
) {
  const days = periodDays[period] ?? 30;
  const endDate = startOfLocalDay(today);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  return transactions.filter((transaction) => {
    const date = parseLocalDate(transaction.date);
    return date !== null && date >= startDate && date <= endDate;
  });
}

export function formatTransactionDate(value: string) {
  const date = parseLocalDate(value);
  return date
    ? date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })
    : value;
}

function amountValue(value: string) {
  return Number(value.replaceAll(",", "").replace(/[^\d.-]/g, "")) || 0;
}

export function summarizeTransactions(transactions: Transaction[]) {
  const inflow = transactions
    .filter((transaction) => transaction.type === "Credit")
    .reduce((total, transaction) => total + amountValue(transaction.amount), 0);
  const outflow = transactions
    .filter((transaction) => transaction.type === "Debit")
    .reduce((total, transaction) => total + amountValue(transaction.amount), 0);

  return {
    inflow,
    outflow,
    net: inflow - outflow,
    creditCount: transactions.filter((transaction) => transaction.type === "Credit").length,
    debitCount: transactions.filter((transaction) => transaction.type === "Debit").length,
  };
}

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}
