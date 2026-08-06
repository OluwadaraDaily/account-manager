import type { Transaction } from "../types/transaction";
import { formatTransactionDate } from "../utils/transactionPeriods";

type TransactionTableProps = {
  transactions: Transaction[];
};

export function TransactionTable({ transactions }: TransactionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-line text-muted border-b text-[10px] font-bold tracking-[0.13em] uppercase">
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
              className="border-line/70 border-b last:border-0"
            >
              <td className="text-muted px-5 py-5 text-[12px] sm:px-7">
                {formatTransactionDate(item.date)}
              </td>
              <td className="px-3 py-5 text-[13px] font-semibold">{item.description}</td>
              <td className="text-muted px-3 py-5 text-[13px]">{item.counterparty}</td>
              <td className="px-3 py-5">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.type === "Credit" ? "bg-[#edf6e7] text-[#5c8655]" : "bg-[#fff1ef] text-[#c66b61]"}`}
                >
                  {item.type}
                </span>
              </td>
              <td
                className={`px-3 py-5 text-right text-[13px] font-bold ${item.type === "Credit" ? "text-[#5c8655]" : "text-ink"}`}
              >
                {item.type === "Credit" ? "+" : "−"}
                {item.amount}
              </td>
              <td className="px-5 py-5 text-right sm:px-7">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${item.status === "Review" ? "text-[#c18b47]" : "text-moss"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${item.status === "Review" ? "bg-[#e6b568]" : "bg-[#9ec978]"}`}
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
