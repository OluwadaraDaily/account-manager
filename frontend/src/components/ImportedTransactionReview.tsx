import { useEffect, useState } from "react";
import {
  listImportedTransactions,
  updateImportedTransaction,
  type ImportedTransaction,
} from "../google/gmailAuth";
import {
  downloadImportedTransactionsAsCsv,
  downloadImportedTransactionsAsXlsx,
} from "../utils/exportTransactions";

type ImportedTransactionReviewProps = {
  bankId: string;
  refreshKey: number;
};

type EditableTransactionDraft = {
  direction: "debit" | "credit" | "";
  transactionDate: string;
  amount: string;
  counterparty: string;
  description: string;
};

const reviewReasonLabels: Record<string, string> = {
  amount_missing: "Amount is missing",
  conflicting_direction_signals: "Debit and credit signals conflict",
  date_fallback_used: "Date came from message metadata",
  date_missing: "Transaction date is missing",
  direction_ambiguous: "Debit or credit direction is ambiguous",
  possible_reversal_or_refund: "Possible reversal or refund",
};

function formatReviewReason(reason: string) {
  return reviewReasonLabels[reason] ?? reason.replaceAll("_", " ");
}

function toEditableDraft(transaction: ImportedTransaction): EditableTransactionDraft {
  return {
    direction: transaction.direction ?? "",
    transactionDate: transaction.transactionDate ?? "",
    amount: transaction.amount ?? "",
    counterparty: transaction.counterparty ?? "",
    description: transaction.description ?? "",
  };
}

function hasDraftChanges(transaction: ImportedTransaction, draft: EditableTransactionDraft) {
  return (
    draft.direction !== (transaction.direction ?? "") ||
    draft.transactionDate !== (transaction.transactionDate ?? "") ||
    draft.amount !== (transaction.amount ?? "") ||
    draft.counterparty !== (transaction.counterparty ?? "") ||
    draft.description !== (transaction.description ?? "")
  );
}

export function ImportedTransactionReview({ bankId, refreshKey }: ImportedTransactionReviewProps) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTransactionId, setSavingTransactionId] = useState<string | null>(null);
  const [draftTransactions, setDraftTransactions] = useState<
    Record<string, EditableTransactionDraft>
  >({});
  const [error, setError] = useState<string | null>(null);
  const needsReviewCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs-review",
  ).length;
  const readyCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "ready",
  ).length;
  const dismissedCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "dismissed",
  ).length;

  useEffect(() => {
    let cancelled = false;

    if (!bankId) {
      setTransactions([]);
      setDraftTransactions({});
      setError(null);
      return;
    }

    setLoading(true);
    void listImportedTransactions(bankId)
      .then((nextTransactions) => {
        if (!cancelled) {
          setTransactions(nextTransactions);
          setDraftTransactions(
            Object.fromEntries(
              nextTransactions.map((transaction) => [transaction.id, toEditableDraft(transaction)]),
            ),
          );
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Imported transactions could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bankId, refreshKey]);

  const saveTransaction = async (transactionId: string) => {
    const draft = draftTransactions[transactionId];
    if (!draft) return;

    setError(null);
    setSavingTransactionId(transactionId);
    try {
      const updatedTransaction = await updateImportedTransaction(bankId, transactionId, {
        direction: draft.direction || undefined,
        transactionDate: draft.transactionDate || null,
        amount: draft.amount || null,
        counterparty: draft.counterparty.trim() || null,
        description: draft.description.trim() || null,
      });
      setTransactions((currentTransactions) =>
        currentTransactions.map((transaction) =>
          transaction.id === transactionId ? updatedTransaction : transaction,
        ),
      );
      setDraftTransactions((currentDrafts) => ({
        ...currentDrafts,
        [transactionId]: toEditableDraft(updatedTransaction),
      }));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The transaction could not be updated.",
      );
    } finally {
      setSavingTransactionId(null);
    }
  };

  const dismissTransaction = async (transactionId: string) => {
    setError(null);
    setSavingTransactionId(transactionId);
    try {
      const updatedTransaction = await updateImportedTransaction(bankId, transactionId, {
        reviewStatus: "dismissed",
      });
      setTransactions((currentTransactions) =>
        currentTransactions.map((transaction) =>
          transaction.id === transactionId ? updatedTransaction : transaction,
        ),
      );
      setDraftTransactions((currentDrafts) => ({
        ...currentDrafts,
        [transactionId]: toEditableDraft(updatedTransaction),
      }));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The transaction could not be dismissed.",
      );
    } finally {
      setSavingTransactionId(null);
    }
  };

  return (
    <section
      aria-labelledby="imported-review-heading"
      className="border-line border-b bg-[#fafcf9] px-5 py-5 sm:px-7"
    >
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2
            id="imported-review-heading"
            className="text-moss text-[11px] font-bold tracking-[0.16em] uppercase"
          >
            Imported transactions
          </h2>
          <p className="text-muted mt-1 text-[12px]">
            Normalized results from the selected bank. Review and correct any uncertain items.
          </p>
          {!loading && !error && (
            <p className="text-muted mt-2 text-[12px]" aria-live="polite">
              {needsReviewCount} transaction{needsReviewCount === 1 ? "" : "s"} need review.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadImportedTransactionsAsCsv(transactions)}
            disabled={
              loading ||
              Boolean(error) ||
              transactions.every((transaction) => transaction.reviewStatus === "dismissed")
            }
            className="border-line text-ink hover:border-ink rounded-full border px-4 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void downloadImportedTransactionsAsXlsx(transactions)}
            disabled={
              loading ||
              Boolean(error) ||
              transactions.every((transaction) => transaction.reviewStatus === "dismissed")
            }
            className="bg-ink text-card hover:bg-moss-dark rounded-full px-4 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export XLSX
          </button>
        </div>
      </div>

      {loading && <p className="text-muted text-[12px]">Loading imported transactions…</p>}
      {error && (
        <p className="text-[12px] text-[#b34f42]" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && transactions.length === 0 && (
        <p className="text-muted text-[12px]">No imported transactions for this bank yet.</p>
      )}
      {!loading && !error && transactions.length > 0 && (
        <div
          className="border-line mb-4 rounded-[12px] border px-3 py-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-ink text-[12px] font-semibold">
            {needsReviewCount === 0 ? "Review complete." : "Review in progress."}
          </p>
          <dl className="text-muted mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
            <div>
              <dt>Total</dt>
              <dd className="text-ink font-semibold">{transactions.length}</dd>
            </div>
            <div>
              <dt>Ready</dt>
              <dd className="text-ink font-semibold">{readyCount}</dd>
            </div>
            <div>
              <dt>Needs review</dt>
              <dd className="text-ink font-semibold">{needsReviewCount}</dd>
            </div>
            <div>
              <dt>Dismissed</dt>
              <dd className="text-ink font-semibold">{dismissedCount}</dd>
            </div>
          </dl>
        </div>
      )}
      {!loading && !error && transactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left">
            <thead>
              <tr className="border-line text-muted border-b text-[10px] font-bold tracking-[0.13em] uppercase">
                <th className="px-2 py-3 font-semibold">Date</th>
                <th className="px-2 py-3 font-semibold">Description</th>
                <th className="px-2 py-3 font-semibold">Counterparty</th>
                <th className="px-2 py-3 font-semibold">Transaction type</th>
                <th className="px-2 py-3 text-right font-semibold">Amount</th>
                <th className="px-2 py-3 font-semibold">Review</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const draft = draftTransactions[transaction.id] ?? toEditableDraft(transaction);
                const changed = hasDraftChanges(transaction, draft);
                const label = transaction.description ?? transaction.id;

                return (
                  <tr key={transaction.id} className="border-line/70 border-b last:border-0">
                    <td className="px-2 py-4 text-[12px]">
                      <input
                        aria-label={`Transaction date for ${label}`}
                        type="date"
                        value={draft.transactionDate}
                        onChange={(event) =>
                          setDraftTransactions((currentDrafts) => ({
                            ...currentDrafts,
                            [transaction.id]: { ...draft, transactionDate: event.target.value },
                          }))
                        }
                        disabled={savingTransactionId !== null}
                        className="border-line bg-card text-ink rounded-[8px] border px-2 py-1 text-[11px]"
                      />
                    </td>
                    <td className="px-2 py-4 text-[12px] font-semibold">
                      <input
                        aria-label={`Description for ${label}`}
                        type="text"
                        value={draft.description}
                        onChange={(event) =>
                          setDraftTransactions((currentDrafts) => ({
                            ...currentDrafts,
                            [transaction.id]: { ...draft, description: event.target.value },
                          }))
                        }
                        disabled={savingTransactionId !== null}
                        className="border-line bg-card text-ink w-full min-w-[180px] rounded-[8px] border px-2 py-1 text-[11px]"
                      />
                    </td>
                    <td className="px-2 py-4 text-[12px]">
                      <input
                        aria-label={`Counterparty for ${label}`}
                        type="text"
                        value={draft.counterparty}
                        onChange={(event) =>
                          setDraftTransactions((currentDrafts) => ({
                            ...currentDrafts,
                            [transaction.id]: { ...draft, counterparty: event.target.value },
                          }))
                        }
                        disabled={savingTransactionId !== null}
                        className="border-line bg-card text-ink w-full min-w-[150px] rounded-[8px] border px-2 py-1 text-[11px]"
                      />
                    </td>
                    <td className="px-2 py-4 text-[12px]">
                      <select
                        aria-label={`Transaction type for ${label}`}
                        value={draft.direction}
                        onChange={(event) =>
                          setDraftTransactions((currentDrafts) => ({
                            ...currentDrafts,
                            [transaction.id]: {
                              ...draft,
                              direction: event.target.value as "debit" | "credit" | "",
                            },
                          }))
                        }
                        disabled={savingTransactionId !== null}
                        className="border-line bg-card text-ink rounded-[8px] border px-2 py-1 text-[11px]"
                      >
                        <option value="">Select type</option>
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </td>
                    <td className="px-2 py-4 text-right text-[12px] font-bold">
                      <input
                        aria-label={`Amount for ${label}`}
                        type="text"
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(event) =>
                          setDraftTransactions((currentDrafts) => ({
                            ...currentDrafts,
                            [transaction.id]: { ...draft, amount: event.target.value },
                          }))
                        }
                        disabled={savingTransactionId !== null}
                        className="border-line bg-card text-ink w-full min-w-[110px] rounded-[8px] border px-2 py-1 text-right text-[11px]"
                      />
                    </td>
                    <td className="px-2 py-4 text-[12px]">
                      <div className="flex items-start gap-2">
                        <div>
                          <span
                            className={
                              transaction.reviewStatus === "needs-review"
                                ? "font-semibold text-[#c18b47]"
                                : transaction.reviewStatus === "dismissed"
                                  ? "text-muted font-semibold"
                                  : "text-moss font-semibold"
                            }
                          >
                            {transaction.reviewStatus === "needs-review"
                              ? "Needs review"
                              : transaction.reviewStatus === "dismissed"
                                ? "Dismissed"
                                : "Ready"}
                          </span>
                          {transaction.reviewReasons.length > 0 && (
                            <ul className="text-muted mt-1 space-y-0.5 text-[11px]">
                              {transaction.reviewReasons.map((reason) => (
                                <li key={reason}>{formatReviewReason(reason)}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void saveTransaction(transaction.id)}
                          disabled={savingTransactionId !== null || !changed}
                          className="text-moss-dark font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingTransactionId === transaction.id ? "Saving…" : "Save"}
                        </button>
                        {transaction.reviewStatus !== "dismissed" && (
                          <button
                            type="button"
                            onClick={() => void dismissTransaction(transaction.id)}
                            disabled={savingTransactionId !== null}
                            className="text-muted font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
