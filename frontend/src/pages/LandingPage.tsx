import { useState } from "react";
import { AccountSnapshot } from "@/components/AccountSnapshot";
import { HeroSection } from "@/components/HeroSection";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { mockTransactions } from "@/data/mockTransactions";
import { filterTransactionsByPeriod } from "@/utils/transactionPeriods";

export function LandingPage() {
  const [period, setPeriod] = useState("Last 30 days");
  const periodTransactions = filterTransactionsByPeriod(mockTransactions, period);

  return (
    <>
      <HeroSection />
      <AccountSnapshot
        period={period}
        onPeriodChange={setPeriod}
        transactions={periodTransactions}
      />
      <PrivacyNotice />
    </>
  );
}
