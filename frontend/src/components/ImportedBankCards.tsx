import { useEffect, useState } from "react";
import { listImportedBanks, type ImportedBankSummary } from "../google/gmailAuth";

type ImportedBankCardsProps = {
  selectedBankId: string;
  refreshKey: number;
  onSelect: (bankId: string) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function ImportedBankCards({
  selectedBankId,
  refreshKey,
  onSelect,
}: ImportedBankCardsProps) {
  const [banks, setBanks] = useState<ImportedBankSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    void listImportedBanks()
      .then((nextBanks) => {
        if (!cancelled) setBanks(nextBanks);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Imported banks could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (loading) return;

    if (banks.length === 0) {
      if (selectedBankId) onSelect("");
      return;
    }

    if (!banks.some((bank) => bank.bankId === selectedBankId)) {
      onSelect(banks[0].bankId);
    }
  }, [banks, loading, onSelect, selectedBankId]);

  return (
    <section
      aria-labelledby="imported-banks-heading"
      className="border-line bg-card border-b px-5 py-5 sm:px-7"
    >
      <div className="mb-4">
        <h2
          id="imported-banks-heading"
          className="text-moss text-[11px] font-bold tracking-[0.16em] uppercase"
        >
          Your imported banks
        </h2>
        <p className="text-muted mt-1 text-[12px]">
          Choose a bank to browse its previous Gmail imports.
        </p>
      </div>

      {loading && <p className="text-muted text-[12px]">Loading imported banks…</p>}
      {error && (
        <p className="text-muted text-[12px]" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && banks.length === 0 && (
        <p className="text-muted text-[12px]">No previous imports yet.</p>
      )}
      {!loading && !error && banks.length > 0 && (
        <div className="border-line bg-line grid gap-px border sm:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank, index) => (
            <button
              key={bank.bankId}
              type="button"
              aria-pressed={selectedBankId === bank.bankId}
              onClick={() => onSelect(bank.bankId)}
              className={`bg-card px-4 py-4 text-left transition ${
                selectedBankId === bank.bankId ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <div className="mb-6 flex items-start justify-between gap-3">
                <span className="text-muted font-mono text-[10px]">0{index + 1}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${selectedBankId === bank.bankId ? "bg-moss" : "bg-line"}`}
                />
              </div>
              <p className="text-ink text-[13px] font-bold tracking-[-0.02em]">
                {bank.displayName}
              </p>
              <p className="text-muted mt-2 font-mono text-[10px] tracking-[0.08em] uppercase">
                {bank.importCount} import{bank.importCount === 1 ? "" : "s"}
              </p>
              <p className="text-muted mt-1 text-[10px]">
                Last imported {formatDate(bank.latestImportAt)}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
