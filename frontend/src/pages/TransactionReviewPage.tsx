import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ImportedTransactionReview } from "@/components/ImportedTransactionReview";
import { getGmailImportJob } from "@/google/gmailAuth";
import { playSensoryCue } from "@/utils/sensoryFeedback";

type TransactionReviewPageProps = {
  bankId: string;
  importJobId: string;
};

export function TransactionReviewPage({ bankId, importJobId }: TransactionReviewPageProps) {
  const importJobQuery = useQuery({
    queryKey: ["gmail-import-job", importJobId],
    queryFn: () => getGmailImportJob(importJobId),
  });
  const importName = importJobQuery.data?.name ?? "Unnamed import";

  const goBackToWorkspace = () => {
    playSensoryCue("navigation");
    window.history.pushState({}, "", "/workspace");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <section className="border-line bg-card border">
      <div className="border-line flex flex-col gap-4 border-b px-5 py-5 sm:px-7">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goBackToWorkspace}
          className="text-muted hover:text-ink -ml-3 w-fit rounded-none px-3 font-mono text-[10px] tracking-[0.1em] uppercase"
        >
          ← Back to Workspace
        </Button>
        <div>
          <p className="text-muted font-mono text-[10px] tracking-[0.16em] uppercase">
            workspace / transaction review
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-[-0.06em]">
            {importName}
          </h1>
          <p className="text-muted mt-2 text-[12px]">
            Review and confirm the transactions extracted from this import.
          </p>
        </div>
      </div>
      <ImportedTransactionReview bankId={bankId} importJobId={importJobId} refreshKey={0} />
    </section>
  );
}
