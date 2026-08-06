import { useState } from "react";
import { GmailSearchForm } from "./GmailSearchForm";
import { ImportedBankCards } from "./ImportedBankCards";
import { ImportedImportHistory } from "./ImportedImportHistory";
import { ImportedTransactionReview } from "./ImportedTransactionReview";

export function TransactionWorkspace() {
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedImportJobId, setSelectedImportJobId] = useState<string | null>(null);
  const [importRefreshKey, setImportRefreshKey] = useState(0);

  return (
    <section className="border-line bg-card overflow-hidden rounded-[24px] border">
      <GmailSearchForm onImportCompleted={() => setImportRefreshKey((current) => current + 1)} />
      <ImportedBankCards
        selectedBankId={selectedBankId}
        refreshKey={importRefreshKey}
        onSelect={(bankId) => {
          setSelectedBankId(bankId);
          setSelectedImportJobId(null);
        }}
      />
      <ImportedImportHistory
        bankId={selectedBankId}
        refreshKey={importRefreshKey}
        selectedJobId={selectedImportJobId}
        onSelect={setSelectedImportJobId}
      />
      <ImportedTransactionReview
        bankId={selectedBankId}
        importJobId={selectedImportJobId}
        refreshKey={importRefreshKey}
      />
    </section>
  );
}
