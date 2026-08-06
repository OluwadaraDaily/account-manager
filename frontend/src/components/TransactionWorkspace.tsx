import { useState } from "react";
import { Icon } from "./Icon";
import { GmailSearchForm } from "./GmailSearchForm";
import { ImportedImportHistory } from "./ImportedImportHistory";
import { ImportedTransactionReview } from "./ImportedTransactionReview";
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
  const [selectedBankId, setSelectedBankId] = useState("");
  const [importRefreshKey, setImportRefreshKey] = useState(0);
  const visibleTransactions = transactions.filter(
    (item) => activeTab === "Overview" || item.status === "Review",
  );
  const exportTransactions = () => {
    const hasUnreviewedTransactions = transactions.some((item) => item.status === "Review");
    if (
      hasUnreviewedTransactions &&
      !window.confirm("Some transactions need review. Export them anyway?")
    ) {
      return;
    }

    onExportCsv();
  };

  return (
    <section className="border-line bg-card overflow-hidden rounded-[24px] border">
      <GmailSearchForm
        onSelectedBankChange={setSelectedBankId}
        onImportCompleted={() => setImportRefreshKey((current) => current + 1)}
      />
      <ImportedImportHistory bankId={selectedBankId} refreshKey={importRefreshKey} />
      <ImportedTransactionReview bankId={selectedBankId} refreshKey={importRefreshKey} />
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
            onClick={exportTransactions}
            className="border-line text-ink hover:border-ink flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-semibold transition"
          >
            <Icon name="download" size={15} /> CSV
          </button>
        </div>
      </div>
      <TransactionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        needsReviewCount={transactions.filter((item) => item.status === "Review").length}
      />
      <TransactionTable transactions={visibleTransactions} />
    </section>
  );
}
