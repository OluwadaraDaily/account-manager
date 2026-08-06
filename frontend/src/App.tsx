import { useState } from "react";
import { AccountSnapshot } from "./components/AccountSnapshot";
import { AppHeader } from "./components/AppHeader";
import { HeroSection } from "./components/HeroSection";
import { PrivacyNotice } from "./components/PrivacyNotice";
import { TransactionWorkspace } from "./components/TransactionWorkspace";
import { mockTransactions } from "./data/mockTransactions";
import { downloadTransactionsAsCsv } from "./utils/exportTransactions";
import { filterTransactionsByPeriod } from "./utils/transactionPeriods";

function App() {
  const [period, setPeriod] = useState("Last 30 days");
  const periodTransactions = filterTransactionsByPeriod(mockTransactions, period);

  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 pb-16 lg:px-10">
        <HeroSection />
        <AccountSnapshot
          period={period}
          onPeriodChange={setPeriod}
          transactions={periodTransactions}
        />
        <TransactionWorkspace
          period={period}
          transactions={periodTransactions}
          onExportCsv={() => downloadTransactionsAsCsv(periodTransactions)}
        />
        <PrivacyNotice />
      </main>
    </div>
  );
}

export default App;
