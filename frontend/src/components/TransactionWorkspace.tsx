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
    <section className="border-line bg-card overflow-hidden border">
      <div className="border-line flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-3">
          <span className="bg-moss h-1.5 w-1.5 rounded-full" />
          <span className="text-muted font-mono text-[10px] tracking-[0.16em] uppercase">
            workspace / live ledger
          </span>
        </div>
        <span className="text-muted font-mono text-[10px] tracking-[0.1em] uppercase">
          review before export
        </span>
      </div>
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
            <SheetTitle className="font-display text-ink text-2xl tracking-[-0.06em]">
              Imported transactions
            </SheetTitle>
            <SheetDescription className="text-muted font-mono text-[10px] tracking-[0.06em] uppercase">
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
