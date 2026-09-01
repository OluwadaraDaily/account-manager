import type { TransactionGroup } from "../api/transactionGroups";

type TransactionGroupSelectProps = {
  groups: TransactionGroup[];
  value: string;
  onChange: (groupId: string) => void;
  disabled?: boolean;
  label: string;
};

export function TransactionGroupSelect({
  groups,
  value,
  onChange,
  disabled = false,
  label,
}: TransactionGroupSelectProps) {
  return (
    <label className="text-muted flex items-center gap-2 text-[10px] font-semibold uppercase">
      Group
      <select
        aria-label={`Group for ${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="border-line bg-card text-ink min-w-0 rounded-none border px-2 py-1 text-[11px] normal-case outline-none focus-visible:ring-1 focus-visible:ring-white"
      >
        <option value="">Ungrouped</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </label>
  );
}
