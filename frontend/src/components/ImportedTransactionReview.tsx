import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import {
  listImportedTransactionsForImport,
  listImportedTransactions,
  updateImportedTransaction,
  type ImportedTransaction,
} from "../google/gmailAuth";
import {
  downloadImportedTransactionsAsCsv,
  downloadImportedTransactionsAsXlsx,
} from "../utils/exportTransactions";
import { formatNaira, formatTransactionDate } from "../utils/transactionPeriods";

type ImportedTransactionReviewProps = {
  bankId: string;
  importJobId: string | null;
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

function amountValue(value: string | null) {
  return Number((value ?? "").replaceAll(",", "").replace(/[^\d.-]/g, "")) || 0;
}

function formatImportedAmount(transaction: ImportedTransaction) {
  if (!transaction.amount) return "—";

  const formattedAmount = formatNaira(amountValue(transaction.amount));
  if (transaction.direction === "credit") return `+${formattedAmount}`;
  if (transaction.direction === "debit") return `−${formattedAmount}`;
  return formattedAmount;
}

export function ImportedTransactionReview({
  bankId,
  importJobId,
  refreshKey,
}: ImportedTransactionReviewProps) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTransactionId, setSavingTransactionId] = useState<string | null>(null);
  const [draftTransactions, setDraftTransactions] = useState<
    Record<string, EditableTransactionDraft>
  >({});
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
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
  const totalAmount = transactions.reduce(
    (total, transaction) => total + amountValue(transaction.amount),
    0,
  );

  useEffect(() => {
    let cancelled = false;

    if (!bankId) {
      setTransactions([]);
      setDraftTransactions({});
      setEditingTransactionId(null);
      setError(null);
      return;
    }

    setLoading(true);
    const loadTransactions = importJobId
      ? listImportedTransactionsForImport(bankId, importJobId)
      : listImportedTransactions(bankId);
    void loadTransactions
      .then((nextTransactions) => {
        if (!cancelled) {
          setTransactions(nextTransactions);
          setDraftTransactions(
            Object.fromEntries(
              nextTransactions.map((transaction) => [transaction.id, toEditableDraft(transaction)]),
            ),
          );
          setEditingTransactionId(null);
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
  }, [bankId, importJobId, refreshKey]);

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
      setEditingTransactionId(null);
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
      setEditingTransactionId(null);
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

  const cancelEdit = (transactionId: string) => {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (transaction) {
      setDraftTransactions((currentDrafts) => ({
        ...currentDrafts,
        [transactionId]: toEditableDraft(transaction),
      }));
    }
    setEditingTransactionId(null);
  };

  return (
    <section
      aria-labelledby="imported-review-heading"
      className="border-line bg-card border-b px-5 py-5 sm:px-7"
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
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => downloadImportedTransactionsAsCsv(transactions)}
            disabled={
              loading ||
              Boolean(error) ||
              transactions.every((transaction) => transaction.reviewStatus === "dismissed")
            }
            variant="outline"
            size="sm"
            className="h-9 rounded-full px-3 text-xs whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export CSV
          </Button>
          <Button
            type="button"
            onClick={() => void downloadImportedTransactionsAsXlsx(transactions)}
            disabled={
              loading ||
              Boolean(error) ||
              transactions.every((transaction) => transaction.reviewStatus === "dismissed")
            }
            size="sm"
            className="h-9 rounded-full bg-white px-3 text-xs whitespace-nowrap text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export XLSX
          </Button>
        </div>
      </div>

      {loading && <p className="text-muted text-[12px]">Loading imported transactions…</p>}
      {error && (
        <p className="text-muted text-[12px]" role="alert">
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
                const isEditing = editingTransactionId === transaction.id;

                return (
                  <tr key={transaction.id} className="border-line/70 border-b last:border-0">
                    <td className="px-2 py-4 text-[12px]">
                      {isEditing ? (
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
                      ) : (
                        <span className="text-muted">
                          {transaction.transactionDate
                            ? formatTransactionDate(transaction.transactionDate)
                            : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-4 text-[12px] font-semibold">
                      {isEditing ? (
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
                      ) : (
                        <span className="text-ink">{transaction.description ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-2 py-4 text-[12px]">
                      {isEditing ? (
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
                      ) : (
                        <span className="text-muted">{transaction.counterparty ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-2 py-4 text-[12px]">
                      {isEditing ? (
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
                      ) : (
                        <span className="text-muted">
                          {transaction.direction === "credit"
                            ? "Credit"
                            : transaction.direction === "debit"
                              ? "Debit"
                              : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-4 text-right text-[12px] font-bold">
                      {isEditing ? (
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
                      ) : (
                        <span
                          className={transaction.direction === "credit" ? "text-ink" : "text-muted"}
                        >
                          {formatImportedAmount(transaction)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-4 text-[12px]">
                      <div className="flex items-start gap-2">
                        <div>
                          <span
                            className={
                              transaction.reviewStatus === "needs-review"
                                ? "text-muted font-semibold"
                                : transaction.reviewStatus === "dismissed"
                                  ? "text-muted font-semibold"
                                  : "text-ink font-semibold"
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
                        {isEditing ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void saveTransaction(transaction.id)}
                              disabled={savingTransactionId !== null || !changed}
                              aria-label={`Save ${label}`}
                              title={savingTransactionId === transaction.id ? "Saving…" : "Save"}
                              className="text-ink rounded-full hover:bg-white/10"
                            >
                              <CheckIcon />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => cancelEdit(transaction.id)}
                              disabled={savingTransactionId !== null}
                              aria-label={`Cancel editing ${label}`}
                              title="Cancel editing"
                              className="text-muted hover:text-ink rounded-full hover:bg-white/10"
                            >
                              <XIcon />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingTransactionId(transaction.id)}
                            disabled={savingTransactionId !== null}
                            aria-label={`Edit ${label}`}
                            title="Edit transaction"
                            className="text-muted hover:text-ink rounded-full hover:bg-white/10"
                          >
                            <PencilIcon />
                          </Button>
                        )}
                        {transaction.reviewStatus !== "dismissed" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => void dismissTransaction(transaction.id)}
                            disabled={savingTransactionId !== null}
                            className="text-muted hover:text-ink px-1 hover:bg-white/10"
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-line border-t">
                <td
                  colSpan={4}
                  className="text-muted px-2 py-4 text-right text-[12px] font-semibold"
                >
                  Total
                </td>
                <td className="text-ink px-2 py-4 text-right text-[12px] font-bold">
                  {formatNaira(totalAmount)}
                </td>
                <td className="px-2 py-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
