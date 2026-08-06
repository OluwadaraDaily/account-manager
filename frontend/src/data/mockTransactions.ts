import type { Transaction } from "../types/transaction";

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export const mockTransactions: Transaction[] = [
  {
    date: daysAgo(2),
    description: "POS PURCHASE",
    counterparty: "Shoprite Ikeja",
    type: "Debit",
    amount: "₦24,850.00",
    status: "Matched",
  },
  {
    date: daysAgo(3),
    description: "TRANSFER IN",
    counterparty: "John Doe",
    type: "Credit",
    amount: "₦150,000.00",
    status: "Matched",
  },
  {
    date: daysAgo(4),
    description: "USSD TRANSFER",
    counterparty: "DSTV Nigeria",
    type: "Debit",
    amount: "₦37,000.00",
    status: "Matched",
  },
  {
    date: daysAgo(6),
    description: "ATM WITHDRAWAL",
    counterparty: "Union Bank ATM",
    type: "Debit",
    amount: "₦50,000.00",
    status: "Review",
  },
  {
    date: daysAgo(40),
    description: "TRANSFER IN",
    counterparty: "Salary / Acme Ltd",
    type: "Credit",
    amount: "₦480,000.00",
    status: "Matched",
  },
];
