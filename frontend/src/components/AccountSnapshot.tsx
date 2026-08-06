import { Icon } from "./Icon";
import { StatCard } from "./StatCard";
import { formatNaira, summarizeTransactions } from "../utils/transactionPeriods";
import type { Transaction } from "../types/transaction";

type AccountSnapshotProps = {
  period: string;
  onPeriodChange: (period: string) => void;
  transactions: Transaction[];
};

export function AccountSnapshot({ period, onPeriodChange, transactions }: AccountSnapshotProps) {
  const summary = summarizeTransactions(transactions);

  return (
    <section className="py-10">
      <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-moss mb-2 text-[11px] font-bold tracking-[0.18em] uppercase">
            Your account snapshot
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.055em]">Union Bank</h2>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="period" className="text-muted text-[12px]">
            Showing
          </label>
          <div className="relative">
            <span className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              <Icon name="calendar" size={15} />
            </span>
            <select
              id="period"
              aria-label="Rolling date range"
              value={period}
              onChange={(event) => onPeriodChange(event.target.value)}
              className="border-line bg-card focus:border-moss appearance-none rounded-full border py-2.5 pr-10 pl-10 text-[12px] font-semibold outline-none"
            >
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 365 days</option>
            </select>
            <span className="text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
              <Icon name="chevron" size={15} />
            </span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total inflow"
          value={formatNaira(summary.inflow)}
          note={`${summary.creditCount} credits`}
          tone="green"
        />
        <StatCard
          label="Total outflow"
          value={formatNaira(summary.outflow)}
          note={`${summary.debitCount} debits`}
          tone="red"
        />
        <StatCard
          label="Net movement"
          value={formatNaira(summary.net)}
          note="This period"
          tone="dark"
        />
      </div>
    </section>
  );
}
