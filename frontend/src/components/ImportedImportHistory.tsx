import { useEffect, useState } from "react";
import {
  listGmailImportHistory,
  type GmailImportHistoryItem,
  type GmailImportHistoryPage,
} from "../google/gmailAuth";

type ImportedImportHistoryProps = {
  bankId: string;
  refreshKey: number;
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
};

const pageSize = 10;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateRange(item: GmailImportHistoryItem) {
  const { after, before } = item.criteria;
  const start = after === null ? "Start not set" : new Date(after * 1000).toLocaleDateString();
  const end = before === null ? "End not set" : new Date(before * 1000).toLocaleDateString();
  return `${start} – ${end}`;
}

function statusLabel(status: GmailImportHistoryItem["status"]) {
  return status === "completed"
    ? "Completed"
    : status === "failed"
      ? "Failed"
      : status === "cancelled"
        ? "Cancelled"
        : status === "running"
          ? "Running"
          : "Queued";
}

export function ImportedImportHistory({
  bankId,
  refreshKey,
  selectedJobId,
  onSelect,
}: ImportedImportHistoryProps) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<GmailImportHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!bankId) {
      setPage(1);
      setHistory(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    void listGmailImportHistory(bankId, page, pageSize)
      .then((nextHistory) => {
        if (!cancelled) setHistory(nextHistory);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Import history could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bankId, page, refreshKey]);

  if (!bankId) return null;

  return (
    <section
      aria-labelledby="import-history-heading"
      className="border-line bg-card border-b px-5 py-5 sm:px-7"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2
            id="import-history-heading"
            className="text-moss text-[11px] font-bold tracking-[0.16em] uppercase"
          >
            Import history
          </h2>
          <p className="text-muted mt-1 text-[12px]">
            Previous Gmail imports for the selected bank.
          </p>
        </div>
        {history && (
          <span className="text-muted text-[11px]">
            {history.pagination.total} import{history.pagination.total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading && <p className="text-muted text-[12px]">Loading import history…</p>}
      {error && (
        <p className="text-muted text-[12px]" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && history?.jobs.length === 0 && (
        <p className="text-muted text-[12px]">No previous imports for this bank yet.</p>
      )}
      {!loading && !error && history && history.jobs.length > 0 && (
        <ol className="border-line divide-line divide-y border">
          {history.jobs.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={selectedJobId === item.id}
                className={`flex w-full flex-col gap-3 px-4 py-4 text-left transition sm:flex-row sm:items-center sm:justify-between ${
                  selectedJobId === item.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.status === "completed" ? "bg-moss" : "bg-line"}`}
                  />
                  <div>
                    <p className="text-ink font-mono text-[11px] font-semibold tracking-[0.02em]">
                      {item.completedAt
                        ? formatDateTime(item.completedAt)
                        : formatDateTime(item.createdAt)}
                    </p>
                    <p className="text-muted mt-1 text-[11px]">
                      {formatDateRange(item)} · {item.progress.transactionsExtracted} transaction
                      {item.progress.transactionsExtracted === 1 ? "" : "s"} extracted ·{" "}
                      {item.progress.messagesSkipped} skipped
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] font-semibold tracking-[0.1em] uppercase ${
                    item.status === "completed" ? "text-ink" : "text-muted"
                  }`}
                >
                  {statusLabel(item.status)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {history && history.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((currentPage) => currentPage - 1)}
            disabled={loading || !history.pagination.hasPrevious}
            className="border-line text-ink rounded-none border px-3 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted text-[11px]">
            Page {history.pagination.page} of {history.pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((currentPage) => currentPage + 1)}
            disabled={loading || !history.pagination.hasNext}
            className="border-line text-ink rounded-none border px-3 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
