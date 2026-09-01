import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { playSensoryCue } from "../utils/sensoryFeedback";
import { InlineAlert } from "./InlineAlert";
import { TransactionTabs } from "./TransactionTabs";
import { TransactionGroupingSummary } from "./TransactionGroupingSummary";
import { TransactionGroupSelect } from "./TransactionGroupSelect";
import {
  assignTransactionToGroup,
  listTransactionGroupMemberships,
  listTransactionGroups,
  unassignTransaction,
} from "../api/transactionGroups";

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
  const queryClient = useQueryClient();
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTransactionId, setSavingTransactionId] = useState<string | null>(null);
  const [draftTransactions, setDraftTransactions] = useState<
    Record<string, EditableTransactionDraft>
  >({});
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Needs review");
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [movingTransactionId, setMovingTransactionId] = useState<string | null>(null);
  const groupsQuery = useQuery({
    queryKey: ["transaction-groups", bankId, refreshKey],
    queryFn: () => listTransactionGroups(bankId),
    enabled: Boolean(bankId),
  });
  const membershipsQuery = useQuery({
    queryKey: ["transaction-group-memberships", bankId, refreshKey],
    queryFn: () => listTransactionGroupMemberships(bankId),
    enabled: Boolean(bankId),
  });
  const moveTransactionMutation = useMutation({
    mutationFn: async ({ transactionId, groupId }: { transactionId: string; groupId: string }) => {
      if (groupId) {
        await assignTransactionToGroup(bankId, groupId, transactionId);
        return;
      }
      await unassignTransaction(bankId, transactionId);
    },
    onSuccess: () => {
      setMovingTransactionId(null);
      void queryClient.invalidateQueries({ queryKey: ["transaction-groups", bankId] });
      void queryClient.invalidateQueries({ queryKey: ["transaction-group-memberships", bankId] });
    },
    onError: (requestError: unknown) => {
      setMovingTransactionId(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The transaction could not be moved.",
      );
    },
  });
  const needsReviewCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "needs-review",
  ).length;
  const readyCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "ready",
  ).length;
  const dismissedCount = transactions.filter(
    (transaction) => transaction.reviewStatus === "dismissed",
  ).length;
  const visibleTransactions = transactions.filter((transaction) =>
    activeTab === "Overview"
      ? transaction.reviewStatus !== "dismissed"
      : activeTab === "Needs review"
        ? transaction.reviewStatus === "needs-review"
        : transaction.reviewStatus === "ready",
  );
  const visibleTotalAmount = visibleTransactions.reduce(
    (total, transaction) => total + amountValue(transaction.amount),
    0,
  );
  const groupIdByTransactionId = new Map(
    (membershipsQuery.data ?? []).map((membership) => [membership.transactionId, membership.groupId]),
  );

  const moveTransaction = (transactionId: string, groupId: string) => {
    setError(null);
    setMovingTransactionId(transactionId);
    moveTransactionMutation.mutate({ transactionId, groupId });
  };

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
          setActiveTab(
            nextTransactions.some((transaction) => transaction.reviewStatus === "needs-review")
              ? "Needs review"
              : "Overview",
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
  }, [bankId, importJobId, refreshKey, retryKey]);

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
      playSensoryCue("success");
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
      playSensoryCue("success");
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
            className="h-10 rounded-none px-3 font-mono text-[10px] tracking-[0.08em] whitespace-nowrap uppercase disabled:cursor-not-allowed disabled:opacity-40"
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
            className="h-10 rounded-none bg-white px-3 font-mono text-[10px] tracking-[0.08em] whitespace-nowrap text-black uppercase hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export XLSX
          </Button>
        </div>
      </div>

      {loading && <p className="text-muted text-[12px]">Loading imported transactions…</p>}
      {error && (
        <InlineAlert message={error} onRetry={() => setRetryKey((current) => current + 1)} />
      )}
      {!loading && !error && transactions.length === 0 && (
        <p className="text-muted text-[12px]">No imported transactions for this bank yet.</p>
      )}
      {!loading && !error && transactions.length > 0 && (
        <TransactionTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          needsReviewCount={needsReviewCount}
          confirmedCount={readyCount}
        />
      )}
      {!loading && !error && transactions.length > 0 && (
        <TransactionGroupingSummary
          bankId={bankId}
          transactionIds={transactions.map((transaction) => transaction.id)}
          refreshKey={refreshKey}
        />
      )}
      {!loading && !error && transactions.length > 0 && (
        <div className="border-line mb-4 border px-3 py-3" role="status" aria-live="polite">
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
      {!loading && !error && transactions.length > 0 && visibleTransactions.length === 0 && (
        <p className="text-muted py-5 text-[12px]">
          {activeTab === "Needs review"
            ? "No transactions need review."
            : activeTab === "Confirmed"
              ? "No confirmed transactions yet."
              : "No transactions to show."}
        </p>
      )}
      {!loading && !error && visibleTransactions.length > 0 && (
        <div className="grid gap-3 md:hidden">
          {visibleTransactions.map((transaction) => {
            const draft = draftTransactions[transaction.id] ?? toEditableDraft(transaction);
            const changed = hasDraftChanges(transaction, draft);
            const label = transaction.description ?? transaction.id;
            const isEditing = editingTransactionId === transaction.id;

            return (
              <article key={transaction.id} className="border-line bg-paper border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-[13px] font-semibold break-words">
                      {transaction.description ?? "Untitled transaction"}
                    </p>
                    <p className="text-muted mt-1 font-mono text-[10px] tracking-[0.08em] uppercase">
                      {transaction.transactionDate
                        ? formatTransactionDate(transaction.transactionDate)
                        : "Date not set"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-right text-[13px] font-bold ${transaction.direction === "credit" ? "text-ink" : "text-muted"}`}
                  >
                    {formatImportedAmount(transaction)}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-4 grid gap-3">
                    <label className="text-muted flex flex-col gap-1 text-[10px] font-semibold uppercase">
                      Date
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
                        className="border-line bg-card text-ink rounded-none border px-2 py-2 text-[11px]"
                      />
                    </label>
                    <label className="text-muted flex flex-col gap-1 text-[10px] font-semibold uppercase">
                      Description
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
                        className="border-line bg-card text-ink rounded-none border px-2 py-2 text-[11px]"
                      />
                    </label>
                    <label className="text-muted flex flex-col gap-1 text-[10px] font-semibold uppercase">
                      Counterparty
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
                        className="border-line bg-card text-ink rounded-none border px-2 py-2 text-[11px]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-muted flex flex-col gap-1 text-[10px] font-semibold uppercase">
                        Type
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
                          className="border-line bg-card text-ink rounded-none border px-2 py-2 text-[11px]"
                        >
                          <option value="">Select type</option>
                          <option value="debit">Debit</option>
                          <option value="credit">Credit</option>
                        </select>
                      </label>
                      <label className="text-muted flex flex-col gap-1 text-[10px] font-semibold uppercase">
                        Amount
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
                          className="border-line bg-card text-ink rounded-none border px-2 py-2 text-right text-[11px]"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <dl className="text-muted mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[11px]">
                    <div>
                      <dt className="font-mono text-[9px] tracking-[0.1em] uppercase">
                        Counterparty
                      </dt>
                      <dd className="text-ink mt-0.5 break-words">
                        {transaction.counterparty ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9px] tracking-[0.1em] uppercase">Type</dt>
                      <dd className="text-ink mt-0.5">{transaction.direction ?? "—"}</dd>
                    </div>
                  </dl>
                )}

                <div className="mt-4">
                  <TransactionGroupSelect
                    groups={groupsQuery.data ?? []}
                    value={groupIdByTransactionId.get(transaction.id) ?? ""}
                    onChange={(groupId) => moveTransaction(transaction.id, groupId)}
                    disabled={
                      movingTransactionId !== null ||
                      groupsQuery.isPending ||
                      membershipsQuery.isPending
                    }
                    label={label}
                  />
                </div>

                <div className="border-line mt-4 border-t pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-ink text-[11px] font-semibold">
                        {transaction.reviewStatus === "needs-review"
                          ? "Needs review"
                          : transaction.reviewStatus === "dismissed"
                            ? "Dismissed"
                            : "Ready"}
                      </p>
                      {transaction.reviewReasons.length > 0 && (
                        <ul className="text-muted mt-1 space-y-0.5 text-[10px]">
                          {transaction.reviewReasons.map((reason) => (
                            <li key={reason}>{formatReviewReason(reason)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void saveTransaction(transaction.id)}
                            disabled={savingTransactionId !== null || !changed}
                            className="rounded-none font-mono text-[10px] uppercase"
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelEdit(transaction.id)}
                            disabled={savingTransactionId !== null}
                            className="rounded-none font-mono text-[10px] uppercase"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingTransactionId(transaction.id)}
                          disabled={savingTransactionId !== null}
                          className="rounded-none font-mono text-[10px] uppercase"
                        >
                          Edit
                        </Button>
                      )}
                      {transaction.reviewStatus !== "dismissed" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void dismissTransaction(transaction.id)}
                          disabled={savingTransactionId !== null}
                          className="text-muted hover:text-ink rounded-none font-mono text-[10px] uppercase"
                        >
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          <div className="border-line flex items-center justify-between border-t pt-4">
            <span className="text-muted text-[11px] font-semibold uppercase">Total</span>
            <span className="text-ink text-[12px] font-bold">{formatNaira(visibleTotalAmount)}</span>
          </div>
        </div>
      )}
      {!loading && !error && visibleTransactions.length > 0 && (
        <div className="hidden overflow-x-auto overscroll-x-contain md:block">
          <table className="w-full min-w-[1180px] table-fixed text-left">
            <thead>
              <tr className="border-line text-muted border-b text-[10px] font-bold tracking-[0.13em] uppercase">
                <th className="px-2 py-3 font-semibold">Date</th>
                <th className="w-[190px] px-2 py-3 font-semibold">Description</th>
                <th className="px-2 py-3 font-semibold">Counterparty</th>
                <th className="px-2 py-3 font-semibold">Transaction type</th>
                <th className="px-2 py-3 text-right font-semibold">Amount</th>
                <th className="px-2 py-3 font-semibold">Group</th>
                <th className="px-2 py-3 font-semibold">Review</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((transaction) => {
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
                          className="border-line bg-card text-ink rounded-none border px-2 py-1 text-[11px]"
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
                          className="border-line bg-card text-ink w-full min-w-0 rounded-none border px-2 py-1 text-[11px]"
                        />
                      ) : (
                        <span className="text-ink block max-w-full break-words">
                          {transaction.description ?? "—"}
                        </span>
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
                          className="border-line bg-card text-ink w-full min-w-[150px] rounded-none border px-2 py-1 text-[11px]"
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
                          className="border-line bg-card text-ink rounded-none border px-2 py-1 text-[11px]"
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
                          className="border-line bg-card text-ink w-full min-w-[110px] rounded-none border px-2 py-1 text-right text-[11px]"
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
                      <TransactionGroupSelect
                        groups={groupsQuery.data ?? []}
                        value={groupIdByTransactionId.get(transaction.id) ?? ""}
                        onChange={(groupId) => moveTransaction(transaction.id, groupId)}
                        disabled={
                          movingTransactionId !== null ||
                          groupsQuery.isPending ||
                          membershipsQuery.isPending
                        }
                        label={label}
                      />
                    </td>
                    <td className="px-2 py-4 text-[12px]">
                      <div className="grid min-w-[220px] grid-cols-[minmax(0,1fr)_4.5rem_4rem] items-center gap-2">
                        <div className="min-w-0">
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
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void saveTransaction(transaction.id)}
                              disabled={savingTransactionId !== null || !changed}
                              aria-label={`Save ${label}`}
                              title={savingTransactionId === transaction.id ? "Saving…" : "Save"}
                              className="text-ink rounded-none hover:bg-white/10"
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
                              className="text-muted hover:text-ink rounded-none hover:bg-white/10"
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
                            className="text-muted hover:text-ink justify-self-center rounded-none hover:bg-white/10"
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
                            className="text-muted hover:text-ink justify-self-end px-1 hover:bg-white/10"
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
                  colSpan={5}
                  className="text-muted px-2 py-4 text-right text-[12px] font-semibold"
                >
                  Total
                </td>
                <td className="text-ink px-2 py-4 text-right text-[12px] font-bold">
                  {formatNaira(visibleTotalAmount)}
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
