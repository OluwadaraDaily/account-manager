import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createTransactionGroup,
  listTransactionGroupMemberships,
  listTransactionGroups,
} from "../api/transactionGroups";
import { InlineAlert } from "./InlineAlert";

type TransactionGroupingSummaryProps = {
  bankId: string;
  transactionIds: string[];
  refreshKey: number;
};

export function TransactionGroupingSummary({
  bankId,
  transactionIds,
  refreshKey,
}: TransactionGroupingSummaryProps) {
  const queryClient = useQueryClient();
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
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
  const groupsQuery = useQuery({
    queryKey: ["transaction-groups", bankId, refreshKey],
    queryFn: () => listTransactionGroups(bankId),
    enabled: Boolean(bankId && transactionIds.length > 0),
  });
  const membershipsQuery = useQuery({
    queryKey: ["transaction-group-memberships", bankId, refreshKey],
    queryFn: () => listTransactionGroupMemberships(bankId),
    enabled: Boolean(bankId && transactionIds.length > 0),
  });

  if (transactionIds.length === 0) return null;
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

  const selectedTransactionIds = new Set(transactionIds);
  const selectedMemberships = membershipsQuery.data.filter((membership) =>
    selectedTransactionIds.has(membership.transactionId),
  );
  const countsByGroup = new Map<string, number>();
  selectedMemberships.forEach((membership) => {
    countsByGroup.set(membership.groupId, (countsByGroup.get(membership.groupId) ?? 0) + 1);
  });

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
            {transactionIds.length - selectedMemberships.length} ungrouped
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
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {groupsQuery.data.map((group) => (
          <div key={group.id} className="flex items-baseline gap-2 text-[11px]">
            <span className="text-ink font-semibold">{group.name}</span>
            <span className="text-muted">{countsByGroup.get(group.id) ?? 0}</span>
          </div>
        ))}
        {groupsQuery.data.length === 0 && <p className="text-muted text-[11px]">No groups created yet.</p>}
      </div>
    </section>
  );
}
