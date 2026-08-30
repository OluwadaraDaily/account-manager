import type { Transaction } from "../types/transaction";
import { formatTransactionDate } from "../utils/transactionPeriods";

type TransactionTableProps = {
  transactions: Transaction[];
};

export function TransactionTable({ transactions }: TransactionTableProps) {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-line text-muted border-b font-mono text-[10px] font-bold tracking-[0.13em] uppercase">
            <th className="px-5 py-4 font-semibold sm:px-7">Date</th>
            <th className="px-3 py-4 font-semibold">Description</th>
            <th className="px-3 py-4 font-semibold">Counterparty</th>
            <th className="px-3 py-4 font-semibold">Type</th>
            <th className="px-3 py-4 text-right font-semibold">Amount</th>
            <th className="px-5 py-4 text-right font-semibold sm:px-7">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((item) => (
            <tr
              key={`${item.date}-${item.description}`}
              className="border-line/70 border-b last:border-0 hover:bg-white/[0.025]"
            >
              <td className="text-muted px-5 py-5 font-mono text-[11px] sm:px-7">
                {formatTransactionDate(item.date)}
              </td>
              <td className="px-3 py-5 text-[13px] font-semibold tracking-[-0.01em]">
                {item.description}
              </td>
              <td className="text-muted px-3 py-5 text-[12px]">{item.counterparty}</td>
              <td className="px-3 py-5">
                <span
                  className={`font-mono text-[10px] font-bold tracking-[0.08em] uppercase ${item.type === "Credit" ? "text-ink" : "text-muted"}`}
                >
                  {item.type === "Credit" ? "↑" : "↓"}
                  {item.type}
                </span>
              </td>
              <td
                className={`px-3 py-5 text-right font-mono text-[13px] font-bold ${item.type === "Credit" ? "text-ink" : "text-muted"}`}
              >
                {item.type === "Credit" ? "+" : "−"}
                {item.amount}
              </td>
              <td className="px-5 py-5 text-right sm:px-7">
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ${item.status === "Review" ? "text-muted" : "text-ink"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${item.status === "Review" ? "bg-zinc-500" : "bg-white"}`}
                  />
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
