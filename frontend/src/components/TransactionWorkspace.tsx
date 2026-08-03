import { useState } from "react";
import { Icon } from "./Icon";
import { GmailSearchForm } from "./GmailSearchForm";
import { TransactionTable } from "./TransactionTable";
import { TransactionTabs } from "./TransactionTabs";
import type { Transaction } from "../types/transaction";

type TransactionWorkspaceProps = {
  period: string;
  transactions: Transaction[];
  onExportCsv: () => void;
};

export function TransactionWorkspace({
  period,
  transactions,
  onExportCsv,
}: TransactionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState("Overview");
  const visibleTransactions = transactions.filter(
    (item) => activeTab === "Overview" || item.status === "Review",
  );

  return (
    <section className="border-line bg-card overflow-hidden rounded-[24px] border">
      <GmailSearchForm />
      <div className="border-line flex flex-col justify-between gap-5 border-b px-5 py-5 sm:flex-row sm:items-center sm:px-7">
        <div>
          <h2 className="font-display text-[20px] font-extrabold tracking-[-0.04em]">
            Transactions
          </h2>
          <p className="text-muted mt-1 text-[12px]">
            {transactions.length} transactions found in {period.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="border-line text-muted hover:border-ink hover:text-ink flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-semibold transition">
            <Icon name="filter" size={15} /> Filter
          </button>
          <button
            onClick={onExportCsv}
            className="border-line text-ink hover:border-ink flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-semibold transition"
          >
            <Icon name="download" size={15} /> CSV
          </button>
        </div>
      </div>
      <TransactionTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <TransactionTable transactions={visibleTransactions} />
    </section>
  );
}
