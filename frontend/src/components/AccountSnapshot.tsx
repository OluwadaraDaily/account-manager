import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "./Icon";
import { StatCard } from "./StatCard";
import {
  formatNaira,
  groupTransactionsByCounterparty,
  groupTransactionsByMonth,
  summarizeTransactions,
} from "../utils/transactionPeriods";
import type { Transaction } from "../types/transaction";

type AccountSnapshotProps = {
  period: string;
  onPeriodChange: (period: string) => void;
  transactions: Transaction[];
};

export function AccountSnapshot({ period, onPeriodChange, transactions }: AccountSnapshotProps) {
  const summary = summarizeTransactions(transactions);
  const monthlySummaries = groupTransactionsByMonth(transactions);
  const counterpartySummaries = groupTransactionsByCounterparty(transactions);

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
      {monthlySummaries.length > 0 && (
        <Card className="border-line bg-card mt-4 gap-0 overflow-x-auto rounded-[20px] p-0 shadow-none">
          <CardHeader className="gap-0 px-5 pt-5 pb-0">
            <CardTitle className="text-ink text-[13px] font-bold">Monthly movement</CardTitle>
            <CardDescription className="text-muted mt-1 text-[11px]">
              Totals grouped by the transaction’s local month.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-4">
            <table className="w-full min-w-[560px] text-left text-[11px]">
              <thead className="text-muted border-line border-b font-semibold">
                <tr>
                  <th className="px-2 py-2">Month</th>
                  <th className="px-2 py-2 text-right">Inflow</th>
                  <th className="px-2 py-2 text-right">Outflow</th>
                  <th className="px-2 py-2 text-right">Net movement</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaries.map((monthlySummary) => (
                  <tr key={monthlySummary.key} className="border-line/70 border-b last:border-0">
                    <td className="text-ink px-2 py-3 font-semibold">{monthlySummary.month}</td>
                    <td className="text-moss px-2 py-3 text-right font-semibold">
                      {formatNaira(monthlySummary.inflow)}
                    </td>
                    <td className="text-muted px-2 py-3 text-right font-semibold">
                      {formatNaira(monthlySummary.outflow)}
                    </td>
                    <td className="text-ink px-2 py-3 text-right font-semibold">
                      {formatNaira(monthlySummary.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {counterpartySummaries.length > 0 && (
        <Card className="border-line bg-card mt-4 gap-0 overflow-x-auto rounded-[20px] p-0 shadow-none">
          <CardHeader className="gap-0 px-5 pt-5 pb-0">
            <CardTitle className="text-ink text-[13px] font-bold">By counterparty</CardTitle>
            <CardDescription className="text-muted mt-1 text-[11px]">
              Totals grouped by the selected transaction counterparties.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-4">
            <table className="w-full min-w-[560px] text-left text-[11px]">
              <thead className="text-muted border-line border-b font-semibold">
                <tr>
                  <th className="px-2 py-2">Counterparty</th>
                  <th className="px-2 py-2 text-right">Inflow</th>
                  <th className="px-2 py-2 text-right">Outflow</th>
                  <th className="px-2 py-2 text-right">Net movement</th>
                </tr>
              </thead>
              <tbody>
                {counterpartySummaries.map((counterpartySummary) => (
                  <tr
                    key={counterpartySummary.counterparty}
                    className="border-line/70 border-b last:border-0"
                  >
                    <td className="text-ink px-2 py-3 font-semibold">
                      {counterpartySummary.counterparty}
                    </td>
                    <td className="text-moss px-2 py-3 text-right font-semibold">
                      {formatNaira(counterpartySummary.inflow)}
                    </td>
                    <td className="text-muted px-2 py-3 text-right font-semibold">
                      {formatNaira(counterpartySummary.outflow)}
                    </td>
                    <td className="text-ink px-2 py-3 text-right font-semibold">
                      {formatNaira(counterpartySummary.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
