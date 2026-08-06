import type { Transaction } from "../types/transaction";
import type { ImportedTransaction } from "../google/gmailAuth";

type ExportDetails = {
  exportedAt: string;
  fileStamp: string;
};

function getExportDetails(): ExportDetails {
  const exportedAt = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const fileStamp = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}-${pad(exportedAt.getHours())}${pad(exportedAt.getMinutes())}`;

  return { exportedAt: exportedAt.toISOString(), fileStamp };
}

function csvValue(value: string | null): string {
  return `"${(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsvFile(filePrefix: string, fileStamp: string, header: string, rows: string[]) {
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filePrefix}-${fileStamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTransactionsAsCsv(transactions: Transaction[]): void {
  const { exportedAt, fileStamp } = getExportDetails();
  const header = "Date,Description,Counterparty,Type,Amount,Status,ExportedAt";
  const rows = transactions.map((item) =>
    [
      item.date,
      item.description,
      item.counterparty,
      item.type,
      item.amount,
      item.status,
      exportedAt,
    ]
      .map(csvValue)
      .join(","),
  );
  downloadCsvFile("account-manager-transactions", fileStamp, header, rows);
}

export function downloadImportedTransactionsAsCsv(transactions: ImportedTransaction[]): void {
  const exportableTransactions = transactions.filter(
    (transaction) => transaction.reviewStatus !== "dismissed",
  );
  if (exportableTransactions.length === 0) return;

  const hasUnreviewedTransactions = exportableTransactions.some(
    (transaction) => transaction.reviewStatus === "needs-review",
  );
  if (
    hasUnreviewedTransactions &&
    !window.confirm("Some imported transactions need review. Export them anyway?")
  ) {
    return;
  }

  const { exportedAt, fileStamp } = getExportDetails();
  const header =
    "TransactionDate,Direction,Amount,Currency,Counterparty,Description,Channel,Confidence,ReviewStatus,ExportedAt";
  const rows = exportableTransactions.map((transaction) =>
    [
      transaction.transactionDate,
      transaction.direction,
      transaction.amount,
      transaction.currency,
      transaction.counterparty,
      transaction.description,
      transaction.channel,
      transaction.confidence,
      transaction.reviewStatus,
      exportedAt,
    ]
      .map(csvValue)
      .join(","),
  );

  downloadCsvFile("account-manager-imported-transactions", fileStamp, header, rows);
}
