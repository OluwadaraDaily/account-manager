import { useState } from "react";
import { Icon } from "./Icon";
import { TransactionTable } from "./TransactionTable";
import { TransactionTabs } from "./TransactionTabs";
import type { Transaction } from "../types/transaction";

type TransactionsPreviewProps = {
  period: string;
  transactions: Transaction[];
  onExportCsv: () => void;
};

export function TransactionsPreview({
  period,
  transactions,
  onExportCsv,
}: TransactionsPreviewProps) {
  const [activeTab, setActiveTab] = useState("Overview");
  const visibleTransactions = transactions.filter(
    (item) =>
      activeTab === "Overview" ||
      (activeTab === "Needs review" && item.status === "Review") ||
      (activeTab === "Confirmed" && item.status === "Matched"),
  );

  return (
    <section className="border-line bg-card mt-10 overflow-hidden border">
      <div className="border-line flex flex-col justify-between gap-5 border-b px-5 py-5 sm:flex-row sm:items-center sm:px-7">
        <div>
          <div className="text-muted mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase">
            <span className="bg-moss h-1.5 w-1.5 rounded-full" />
            sample view / read-only
          </div>
          <h2 className="font-display text-[20px] font-extrabold tracking-[-0.04em]">
            Transaction preview
          </h2>
          <p className="text-muted mt-1 text-[12px]">
            A sample of how imported transactions will appear after Gmail processing for the last{" "}
            {period.toLowerCase()}.
          </p>
        </div>
        <button
          type="button"
          onClick={onExportCsv}
          className="border-line text-ink hover:border-ink flex items-center gap-2 rounded-none border px-4 py-2.5 font-mono text-[10px] font-semibold tracking-[0.1em] uppercase transition"
        >
          <Icon name="download" size={15} /> Export sample
        </button>
      </div>
      <TransactionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        needsReviewCount={transactions.filter((item) => item.status === "Review").length}
        confirmedCount={transactions.filter((item) => item.status === "Matched").length}
      />
      <TransactionTable transactions={visibleTransactions} />
    </section>
  );
}
