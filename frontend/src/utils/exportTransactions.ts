import type { Transaction } from "../types/transaction";

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

function csvValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
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
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `account-manager-transactions-${fileStamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
