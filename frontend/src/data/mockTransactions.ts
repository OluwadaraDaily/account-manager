import type { Transaction } from "../types/transaction";

export const mockTransactions: Transaction[] = [
  {
    date: "28 Jun 2024",
    description: "POS PURCHASE",
    counterparty: "Shoprite Ikeja",
    type: "Debit",
    amount: "₦24,850.00",
    status: "Matched",
  },
  {
    date: "27 Jun 2024",
    description: "TRANSFER IN",
    counterparty: "John Doe",
    type: "Credit",
    amount: "₦150,000.00",
    status: "Matched",
  },
  {
    date: "25 Jun 2024",
    description: "USSD TRANSFER",
    counterparty: "DSTV Nigeria",
    type: "Debit",
    amount: "₦37,000.00",
    status: "Matched",
  },
  {
    date: "24 Jun 2024",
    description: "ATM WITHDRAWAL",
    counterparty: "Union Bank ATM",
    type: "Debit",
    amount: "₦50,000.00",
    status: "Review",
  },
  {
    date: "21 Jun 2024",
    description: "TRANSFER IN",
    counterparty: "Salary / Acme Ltd",
    type: "Credit",
    amount: "₦480,000.00",
    status: "Matched",
  },
];
