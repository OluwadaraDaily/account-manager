import { useEffect, useState } from "react";
import {
  listImportedTransactions,
  updateImportedTransaction,
  type ImportedTransaction,
} from "../google/gmailAuth";

type ImportedTransactionReviewProps = {
  bankId: string;
  refreshKey: number;
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

function formatAmount(transaction: ImportedTransaction) {
  if (!transaction.amount) return "—";
  return `${transaction.currency ?? ""} ${transaction.amount}`.trim();
}

export function ImportedTransactionReview({ bankId, refreshKey }: ImportedTransactionReviewProps) {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTransactionId, setSavingTransactionId] = useState<string | null>(null);
  const [draftDirections, setDraftDirections] = useState<Record<string, "debit" | "credit" | "">>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const needsReviewCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs-review",
  ).length;

  useEffect(() => {
    let cancelled = false;

    if (!bankId) {
      setTransactions([]);
      setError(null);
      return;
    }

    setLoading(true);
    void listImportedTransactions(bankId)
      .then((nextTransactions) => {
        if (!cancelled) {
          setTransactions(nextTransactions);
          setDraftDirections({});
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

  const saveDirection = async (transactionId: string) => {
    const direction = draftDirections[transactionId];
    if (!direction) return;

    setError(null);
    setSavingTransactionId(transactionId);
    try {
      const updatedTransaction = await updateImportedTransaction(bankId, transactionId, {
        direction,
      });
      setTransactions((currentTransactions) =>
        currentTransactions.map((transaction) =>
          transaction.id === transactionId ? updatedTransaction : transaction,
        ),
      );
      setDraftDirections((currentDirections) => {
        const nextDirections = { ...currentDirections };
        delete nextDirections[transactionId];
        return nextDirections;
      });
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The transaction type could not be updated.",
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
      <div className="mb-4">
        <h2
          id="imported-review-heading"
          className="text-moss text-[11px] font-bold tracking-[0.16em] uppercase"
        >
          Imported transactions
        </h2>
        <p className="text-muted mt-1 text-[12px]">
          Read-only results from the selected bank, including items that need review.
        </p>
        {!loading && !error && (
          <p className="text-muted mt-2 text-[12px]" aria-live="polite">
            {needsReviewCount} transaction{needsReviewCount === 1 ? "" : "s"} need review.
          </p>
        )}
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-line text-muted border-b text-[10px] font-bold tracking-[0.13em] uppercase">
                <th className="px-2 py-3 font-semibold">Date</th>
                <th className="px-2 py-3 font-semibold">Description</th>
                <th className="px-2 py-3 font-semibold">Transaction type</th>
                <th className="px-2 py-3 text-right font-semibold">Amount</th>
                <th className="px-2 py-3 font-semibold">Review</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-line/70 border-b last:border-0">
                  <td className="text-muted px-2 py-4 text-[12px]">
                    {transaction.transactionDate ?? "—"}
                  </td>
                  <td className="px-2 py-4 text-[12px] font-semibold">
                    {transaction.description ?? "—"}
                  </td>
                  <td className="px-2 py-4 text-[12px]">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Transaction type for ${transaction.description ?? transaction.id}`}
                        value={draftDirections[transaction.id] ?? transaction.direction ?? ""}
                        onChange={(event) =>
                          setDraftDirections((currentDirections) => ({
                            ...currentDirections,
                            [transaction.id]: event.target.value as "debit" | "credit" | "",
                          }))
                        }
                        disabled={savingTransactionId !== null}
                        className="border-line bg-card text-ink rounded-[8px] border px-2 py-1 text-[11px]"
                      >
                        <option value="">Select type</option>
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void saveDirection(transaction.id)}
                        disabled={
                          savingTransactionId !== null ||
                          !draftDirections[transaction.id] ||
                          draftDirections[transaction.id] === transaction.direction
                        }
                        className="text-moss-dark font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {savingTransactionId === transaction.id ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-4 text-right text-[12px] font-bold">
                    {formatAmount(transaction)}
                  </td>
                  <td className="px-2 py-4 text-[12px]">
                    <span
                      className={
                        transaction.reviewStatus === "needs-review"
                          ? "font-semibold text-[#c18b47]"
                          : "text-moss font-semibold"
                      }
                    >
                      {transaction.reviewStatus === "needs-review" ? "Needs review" : "Ready"}
                    </span>
                    {transaction.reviewReasons.length > 0 && (
                      <ul className="text-muted mt-1 space-y-0.5 text-[11px]">
                        {transaction.reviewReasons.map((reason) => (
                          <li key={reason}>{formatReviewReason(reason)}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
