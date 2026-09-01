import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTransactionGroup,
  deleteTransactionGroup,
  listTransactionGroupMemberships,
  listTransactionGroups,
  renameTransactionGroup,
} from "../api/transactionGroups";
import { formatNaira } from "../utils/transactionPeriods";
import { InlineAlert } from "./InlineAlert";

type TransactionGroupingSummaryProps = {
  bankId: string;
  transactions: Array<{
    id: string;
    amount: string | null;
    currency: string | null;
    direction: "debit" | "credit" | null;
  }>;
  refreshKey: number;
};

type GroupMoneySummary = {
  count: number;
  outflowMinor: bigint;
  inflowMinor: bigint;
  missingAmountCount: number;
};

function parseMinorUnits(value: string | null) {
  if (!value) return null;
  const normalized = value.replaceAll(",", "").replace(/[^\d.-]/g, "");
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function formatMoney(minorUnits: bigint, currency: string) {
  if (currency === "UNKNOWN") return "—";
  const amount = Number(minorUnits) / 100;
  if (currency === "NGN") return formatNaira(amount);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrencyLabel(currency: string) {
  return currency === "UNKNOWN" ? "Currency unavailable" : currency;
}

export function TransactionGroupingSummary({
  bankId,
  transactions,
  refreshKey,
}: TransactionGroupingSummaryProps) {
  const queryClient = useQueryClient();
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [deletingGroup, setDeletingGroup] = useState<{ id: string; name: string } | null>(null);
  const createGroupMutation = useMutation({
    mutationFn: () => createTransactionGroup(bankId, groupName.trim()),
    onSuccess: () => {
      setGroupName("");
      setFormError(null);
      setCreateFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["transaction-groups", bankId] });
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : "The group could not be created.");
    },
  });
  const renameGroupMutation = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      renameTransactionGroup(bankId, groupId, name),
    onSuccess: () => {
      setEditingGroupId(null);
      setEditingGroupName("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["transaction-groups", bankId] });
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : "The group could not be renamed.");
    },
  });
  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => deleteTransactionGroup(bankId, groupId),
    onSuccess: () => {
      setDeletingGroup(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["transaction-groups", bankId] });
      void queryClient.invalidateQueries({ queryKey: ["transaction-group-memberships", bankId] });
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : "The group could not be deleted.");
    },
  });
  const groupsQuery = useQuery({
    queryKey: ["transaction-groups", bankId, refreshKey],
    queryFn: () => listTransactionGroups(bankId),
    enabled: Boolean(bankId && transactions.length > 0),
  });
  const membershipsQuery = useQuery({
    queryKey: ["transaction-group-memberships", bankId, refreshKey],
    queryFn: () => listTransactionGroupMemberships(bankId),
    enabled: Boolean(bankId && transactions.length > 0),
  });

  if (transactions.length === 0) return null;
  if (groupsQuery.isPending || membershipsQuery.isPending) {
    return <p className="text-muted mb-4 text-[12px]">Loading groups…</p>;
  }
  if (groupsQuery.error || membershipsQuery.error) {
    return (
      <div className="mb-4">
        <InlineAlert
          message={
            groupsQuery.error instanceof Error
              ? groupsQuery.error.message
              : membershipsQuery.error instanceof Error
                ? membershipsQuery.error.message
                : "Transaction groups could not be loaded."
          }
          onRetry={() => {
            void groupsQuery.refetch();
            void membershipsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const selectedTransactionIds = new Set(transactions.map((transaction) => transaction.id));
  const selectedMemberships = membershipsQuery.data.filter((membership) =>
    selectedTransactionIds.has(membership.transactionId),
  );
  const groupIdByTransactionId = new Map(
    selectedMemberships.map((membership) => [membership.transactionId, membership.groupId]),
  );
  const totalsByGroup = new Map<string, Map<string, GroupMoneySummary>>();
  transactions.forEach((transaction) => {
    const groupId = groupIdByTransactionId.get(transaction.id) ?? "ungrouped";
    const currency = transaction.currency ?? "UNKNOWN";
    const totalsByCurrency = totalsByGroup.get(groupId) ?? new Map<string, GroupMoneySummary>();
    const current = totalsByCurrency.get(currency) ?? {
      count: 0,
      outflowMinor: 0n,
      inflowMinor: 0n,
      missingAmountCount: 0,
    };
    const minorUnits = parseMinorUnits(transaction.amount);
    current.count += 1;
    if (minorUnits === null) {
      current.missingAmountCount += 1;
    } else if (transaction.direction === "credit") {
      current.inflowMinor += minorUnits;
    } else if (transaction.direction === "debit") {
      current.outflowMinor += minorUnits;
    } else {
      current.missingAmountCount += 1;
    }
    totalsByCurrency.set(currency, current);
    totalsByGroup.set(groupId, totalsByCurrency);
  });
  const groupNameById = new Map(groupsQuery.data.map((group) => [group.id, group.name]));
  const groupedTotals = [
    ...groupsQuery.data.map((group) => ({ id: group.id, name: group.name })),
    { id: "ungrouped", name: "Ungrouped" },
  ].filter((group) => totalsByGroup.has(group.id));

  return (
    <section aria-labelledby="transaction-groups-heading" className="border-line mb-4 border px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3
            id="transaction-groups-heading"
            className="text-moss text-[10px] font-bold tracking-[0.13em] uppercase"
          >
            Groups
          </h3>
          <p className="text-muted mt-1 text-[11px]">Saved organization for this import.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted text-[11px]">
            {transactions.length - selectedMemberships.length} ungrouped
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFormError(null);
              setCreateFormOpen((open) => !open);
            }}
            className="h-8 rounded-none px-2 font-mono text-[10px] uppercase"
          >
            {createFormOpen ? "Close" : "Create group"}
          </Button>
        </div>
      </div>
      {createFormOpen && (
        <form
          className="border-line mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedName = groupName.trim();
            if (!trimmedName) {
              setFormError("Enter a name for this group.");
              return;
            }
            if (trimmedName.length > 80) {
              setFormError("Group names must be 80 characters or fewer.");
              return;
            }
            setFormError(null);
            createGroupMutation.mutate();
          }}
        >
          <label className="sr-only" htmlFor="new-transaction-group-name">
            Group name
          </label>
          <input
            id="new-transaction-group-name"
            type="text"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Name this group"
            maxLength={80}
            disabled={createGroupMutation.isPending}
            className="border-line bg-paper text-ink min-h-9 min-w-0 flex-1 rounded-none border px-3 text-[12px] outline-none placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-white"
          />
          <Button
            type="submit"
            size="sm"
            disabled={createGroupMutation.isPending}
            className="h-9 rounded-none bg-white px-4 font-mono text-[10px] text-black uppercase hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-70"
          >
            {createGroupMutation.isPending ? "Creating…" : "Save group"}
          </Button>
        </form>
      )}
      {formError && <p className="text-muted mt-2 text-[11px]">{formError}</p>}
      <Dialog
        open={deletingGroup !== null}
        onOpenChange={(open) => {
          if (!open && !deleteGroupMutation.isPending) setDeletingGroup(null);
        }}
      >
        <DialogContent className="border-line bg-card text-ink rounded-none shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-[-0.04em]">Delete group?</DialogTitle>
            <DialogDescription className="text-muted leading-6">
              Delete “{deletingGroup?.name}”? Its transactions will be kept and returned to Ungrouped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingGroup(null)}
              disabled={deleteGroupMutation.isPending}
              className="rounded-none font-mono text-[10px] uppercase"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (deletingGroup) deleteGroupMutation.mutate(deletingGroup.id);
              }}
              disabled={deleteGroupMutation.isPending || deletingGroup === null}
              className="rounded-none bg-white font-mono text-[10px] text-black uppercase hover:bg-zinc-200 disabled:opacity-70"
            >
              {deleteGroupMutation.isPending ? "Deleting…" : "Delete group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="mt-3 grid gap-2">
        {groupedTotals.map((group) => (
          <div key={group.id} className="border-line bg-paper min-w-0 border px-3 py-2 text-[11px]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {editingGroupId === group.id ? (
                <form
                  className="flex min-w-0 flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmedName = editingGroupName.trim();
                  if (!trimmedName) {
                    setFormError("Enter a name for this group.");
                    return;
                  }
                  setFormError(null);
                  renameGroupMutation.mutate({ groupId: group.id, name: trimmedName });
                }}
              >
                <label className="sr-only" htmlFor={`rename-group-${group.id}`}>
                  Rename {group.name}
                </label>
                <input
                  id={`rename-group-${group.id}`}
                  type="text"
                  value={editingGroupName}
                  onChange={(event) => setEditingGroupName(event.target.value)}
                  maxLength={80}
                  disabled={renameGroupMutation.isPending}
                  className="border-line bg-paper text-ink min-h-8 w-36 rounded-none border px-2 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-white"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={renameGroupMutation.isPending}
                  className="h-8 rounded-none bg-white px-2 font-mono text-[10px] text-black uppercase hover:bg-zinc-200 disabled:opacity-70"
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingGroupId(null);
                    setFormError(null);
                  }}
                  disabled={renameGroupMutation.isPending}
                  className="text-muted hover:text-ink h-8 rounded-none px-1 font-mono text-[10px] uppercase"
                >
                  Cancel
                </Button>
                </form>
              ) : (
                <span className="text-ink font-semibold">{group.name}</span>
              )}
              </div>
              <div className="text-muted flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                <span>
                {Array.from(totalsByGroup.get(group.id)?.values() ?? []).reduce(
                  (count, summary) => count + summary.count,
                  0,
                )} transactions
                </span>
                {group.id !== "ungrouped" && editingGroupId !== group.id && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name);
                        setFormError(null);
                      }}
                      className="text-muted hover:text-ink h-7 rounded-none px-1 font-mono text-[9px] uppercase"
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeletingGroup({ id: group.id, name: group.name });
                        setFormError(null);
                      }}
                      className="text-muted hover:text-ink h-7 rounded-none px-1 font-mono text-[9px] uppercase"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-3">
              {Array.from(totalsByGroup.get(group.id)?.entries() ?? []).map(([currency, summary]) => (
                <div key={currency} className="text-muted flex flex-wrap gap-x-2 gap-y-1 text-[10px]">
                  <span className="text-ink font-semibold">{formatCurrencyLabel(currency)}</span>
                  <span>Out {formatMoney(summary.outflowMinor, currency)}</span>
                  <span>In {formatMoney(summary.inflowMinor, currency)}</span>
                  <span>
                    Net {formatMoney(summary.inflowMinor - summary.outflowMinor, currency)}
                  </span>
                  {summary.missingAmountCount > 0 && <span>{summary.missingAmountCount} unavailable</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupsQuery.data.length === 0 && (
          <p className="text-muted text-[11px]">No groups created yet.</p>
        )}
      </div>
    </section>
  );
}
