import { useEffect, useState } from "react";
import {
  listGmailImportHistory,
  renameGmailImportJob,
  type GmailImportHistoryItem,
  type GmailImportHistoryPage,
} from "../google/gmailAuth";
import { playSensoryCue } from "../utils/sensoryFeedback";
import { InlineAlert } from "./InlineAlert";

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
  const [retryKey, setRetryKey] = useState(0);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const startRenaming = (item: GmailImportHistoryItem) => {
    setError(null);
    setEditingJobId(item.id);
    setEditingName(item.name ?? "");
  };

  const cancelRenaming = () => {
    if (savingJobId === null) {
      setEditingJobId(null);
      setEditingName("");
    }
  };

  const saveRename = async (item: GmailImportHistoryItem) => {
    if (!history || savingJobId !== null) return;

    const previousHistory = history;
    const nextName = editingName.trim() || null;
    setHistory({
      ...history,
      jobs: history.jobs.map((job) => (job.id === item.id ? { ...job, name: nextName } : job)),
    });
    setEditingJobId(null);
    setEditingName("");
    setSavingJobId(item.id);

    try {
      await renameGmailImportJob(item.id, nextName);
      playSensoryCue("success");
    } catch (requestError: unknown) {
      setHistory(previousHistory);
      setError(
        requestError instanceof Error ? requestError.message : "The import name could not be saved.",
      );
      playSensoryCue("error");
    } finally {
      setSavingJobId(null);
    }
  };

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
  }, [bankId, page, refreshKey, retryKey]);

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
        <InlineAlert message={error} onRetry={() => setRetryKey((current) => current + 1)} />
      )}
      {!loading && !error && history?.jobs.length === 0 && (
        <div className="border-line bg-paper grid gap-4 border p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="flex items-start gap-3">
            <span className="text-moss font-mono text-[11px] font-bold" aria-hidden="true">
              00
            </span>
            <div>
              <p className="text-ink font-display text-xl tracking-[-0.04em]">
                Your ledger starts here.
              </p>
              <p className="text-muted mt-1 max-w-xl text-[12px] leading-5">
                Search Gmail for this bank’s transaction alerts. Completed imports will appear here
                for review before export.
              </p>
            </div>
          </div>
          <a
            href="#gmail-search"
            onClick={() => playSensoryCue("navigation")}
            className="border-line text-ink focus-ring inline-flex min-h-10 items-center justify-center border px-4 py-2 font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition hover:bg-white hover:text-black"
          >
            Start a Gmail search
          </a>
        </div>
      )}
      {!loading && history && history.jobs.length > 0 && (
        <ol className="border-line divide-line divide-y border">
          {history.jobs.map((item) => (
            <li key={item.id}>
              {editingJobId === item.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveRename(item);
                  }}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                >
                  <input
                    autoFocus
                    type="text"
                    maxLength={100}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    aria-label="Import name"
                    placeholder="Import name"
                    className="border-line bg-card text-ink focus:border-moss focus-visible:ring-moss min-w-0 flex-1 rounded-none border px-3 py-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingJobId !== null}
                      className="bg-white px-3 py-2 font-mono text-[10px] font-bold tracking-[0.1em] text-black uppercase disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelRenaming}
                      disabled={savingJobId !== null}
                      className="border-line text-muted border px-3 py-2 font-mono text-[10px] font-bold tracking-[0.1em] uppercase disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-pressed={selectedJobId === item.id}
                    className={`flex min-w-0 flex-1 flex-col gap-3 px-4 py-4 text-left transition sm:flex-row sm:items-center sm:justify-between ${
                      selectedJobId === item.id ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.status === "completed" ? "bg-moss" : "bg-line"}`}
                      />
                      <div>
                        <p className="text-ink font-mono text-[11px] font-semibold tracking-[0.02em]">
                          {item.name ?? "Unnamed import"}
                        </p>
                        <p className="text-muted mt-1 text-[11px]">
                          {item.completedAt
                            ? `Completed ${formatDateTime(item.completedAt)}`
                            : `Started ${formatDateTime(item.createdAt)}`}
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
                  <button
                    type="button"
                    onClick={() => startRenaming(item)}
                    disabled={savingJobId !== null}
                    aria-label={`Rename ${item.name ?? "unnamed import"}`}
                    className="border-line text-muted focus-ring border-l px-3 font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition hover:bg-white/5 hover:text-ink disabled:opacity-50"
                  >
                    Rename
                  </button>
                </div>
              )}
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
