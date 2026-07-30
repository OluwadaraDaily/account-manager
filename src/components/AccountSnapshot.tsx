import { Icon } from "./Icon";
import { StatCard } from "./StatCard";

type AccountSnapshotProps = {
  period: string;
  onPeriodChange: (period: string) => void;
};

export function AccountSnapshot({ period, onPeriodChange }: AccountSnapshotProps) {
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
            <select
              id="period"
              value={period}
              onChange={(event) => onPeriodChange(event.target.value)}
              className="border-line bg-card focus:border-moss appearance-none rounded-full border py-2.5 pr-10 pl-4 text-[12px] font-semibold outline-none"
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
        <StatCard label="Total inflow" value="₦630,000" note="2 credits" tone="green" />
        <StatCard label="Total outflow" value="₦111,850" note="3 debits" tone="red" />
        <StatCard label="Net movement" value="₦518,150" note="This period" tone="dark" />
      </div>
    </section>
  );
}
