import { useState } from "react";
import { AccountSnapshot } from "./components/AccountSnapshot";
import { AppHeader } from "./components/AppHeader";
import { HeroSection } from "./components/HeroSection";
import { PrivacyNotice } from "./components/PrivacyNotice";
import { TransactionWorkspace } from "./components/TransactionWorkspace";
import { mockTransactions } from "./data/mockTransactions";
import { downloadTransactionsAsCsv, downloadTransactionsAsXlsx } from "./utils/exportTransactions";

function App() {
  const [period, setPeriod] = useState("Last 30 days");

  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 pb-16 lg:px-10">
        <HeroSection />
        <AccountSnapshot period={period} onPeriodChange={setPeriod} />
        <TransactionWorkspace
          period={period}
          transactions={mockTransactions}
          onExportCsv={() => downloadTransactionsAsCsv(mockTransactions)}
          onExportXlsx={() => downloadTransactionsAsXlsx(mockTransactions)}
        />
        <PrivacyNotice />
      </main>
    </div>
  );
}

export default App;
