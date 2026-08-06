import { useState } from "react";
import { TransactionWorkspace } from "@/components/TransactionWorkspace";
import { mockTransactions } from "@/data/mockTransactions";
import { downloadTransactionsAsCsv } from "@/utils/exportTransactions";
import { filterTransactionsByPeriod } from "@/utils/transactionPeriods";

export function WorkspacePage() {
  const [period, setPeriod] = useState("Last 30 days");
  const periodTransactions = filterTransactionsByPeriod(mockTransactions, period);

  return (
    <TransactionWorkspace
      period={period}
      transactions={periodTransactions}
      onExportCsv={() => downloadTransactionsAsCsv(periodTransactions)}
    />
  );
}
