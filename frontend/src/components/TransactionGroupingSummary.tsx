import { useQuery } from "@tanstack/react-query";
import {
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
        <span className="text-muted text-[11px]">
          {transactionIds.length - selectedMemberships.length} ungrouped
        </span>
      </div>
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
