import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
      <Sheet
        open={selectedImportJobId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedImportJobId(null);
        }}
      >
        <SheetContent
          side="right"
          className="border-line bg-card text-ink w-full gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-line shrink-0 border-b px-6 py-5 pr-16">
            <SheetTitle className="font-display text-ink tracking-[-0.04em]">
              Imported transactions
            </SheetTitle>
            <SheetDescription className="text-muted">
              Review and correct the transactions extracted from this import.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ImportedTransactionReview
              bankId={selectedBankId}
              importJobId={selectedImportJobId}
              refreshKey={importRefreshKey}
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
