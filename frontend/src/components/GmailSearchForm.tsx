import { useEffect, useState } from "react";
import {
  createGmailImportJob,
  getBankDirectoryRecord,
  getGmailImportJob,
  listBankDirectory,
  type BankDirectoryListEntry,
  type GmailImportJob,
} from "../google/gmailAuth";
import { localDateRangeToUnixSeconds } from "../google/gmailSearch";
import { playSensoryCue } from "../utils/sensoryFeedback";
import { Icon } from "./Icon";

const inputClassName =
  "border-line bg-card text-ink focus:border-moss focus-visible:ring-moss min-w-0 rounded-none border px-3 py-2.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const activeImportJobStorageKey = "account-manager-active-import-job";

type SearchForm = {
  name: string;
  bankId: string;
  senderEmail: string;
  fromDate: string;
  toDate: string;
  subject: string;
  keyword: string;
};

type GmailSearchFormProps = {
  onImportCompleted?: () => void;
};

export function GmailSearchForm({ onImportCompleted }: GmailSearchFormProps) {
  const [searchForm, setSearchForm] = useState<SearchForm>({
    name: "",
    bankId: "",
    senderEmail: "",
    fromDate: "",
    toDate: "",
    subject: "",
    keyword: "",
  });
  const [banks, setBanks] = useState<BankDirectoryListEntry[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [job, setJob] = useState<GmailImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastSearchMode, setLastSearchMode] = useState<"sender" | "bank-fallback">("sender");
  const dateRangeError = Boolean(
    searchForm.fromDate && searchForm.toDate && searchForm.fromDate > searchForm.toDate,
  );
  const importActive = job !== null && ["queued", "running"].includes(job.status);
  const noMatches = job?.status === "completed" && job.progress.messagesDiscovered === 0;
  const messagesRemaining = job
    ? Math.max(0, job.progress.messagesDiscovered - job.progress.messagesProcessed)
    : 0;
  const retrySeconds = job?.nextAttemptAt
    ? Math.max(0, Math.ceil((Date.parse(job.nextAttemptAt) - Date.now()) / 1000))
    : 0;
  const progressPercent =
    job && job.progress.messagesDiscovered > 0
      ? Math.min(
          100,
          Math.round((job.progress.messagesProcessed / job.progress.messagesDiscovered) * 100),
        )
      : 0;
  const collapseDisabled = importActive || Boolean(error);

  useEffect(() => {
    if (collapseDisabled) setIsExpanded(true);
  }, [collapseDisabled]);

  useEffect(() => {
    let cancelled = false;

    void listBankDirectory()
      .then((entries) => {
        if (cancelled) return;

        setBanks(entries);
        setSearchForm((current) => ({
          ...current,
          bankId: entries.some((bank) => bank.id === current.bankId)
            ? current.bankId
            : (entries[0]?.id ?? ""),
        }));
      })
      .catch((bankError: unknown) => {
        if (!cancelled) {
          setError(
            bankError instanceof Error
              ? bankError.message
              : "The bank directory could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBanksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const activeJobId = window.sessionStorage.getItem(activeImportJobStorageKey);
    if (!activeJobId) return;

    let cancelled = false;

    void getGmailImportJob(activeJobId)
      .then((storedJob) => {
        if (cancelled) return;

        setJob(storedJob);
        if (!["queued", "running"].includes(storedJob.status)) {
          window.sessionStorage.removeItem(activeImportJobStorageKey);
        }
      })
      .catch((restoreError: unknown) => {
        if (!cancelled) {
          setError(
            restoreError instanceof Error
              ? restoreError.message
              : "The active Gmail import could not be restored.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const nextJob = await getGmailImportJob(job.id);
        if (cancelled) return;

        setJob(nextJob);
        if (nextJob.status === "queued" || nextJob.status === "running") {
          timeoutId = window.setTimeout(() => void poll(), 1000);
        } else if (nextJob.status === "completed") {
          window.sessionStorage.removeItem(activeImportJobStorageKey);
          playSensoryCue("success");
          onImportCompleted?.();
        } else if (nextJob.status === "failed") {
          window.sessionStorage.removeItem(activeImportJobStorageKey);
          playSensoryCue("error");
          setError(nextJob.errorMessage ?? "The Gmail import failed.");
        }
      } catch (pollError: unknown) {
        if (!cancelled) {
          setError(
            pollError instanceof Error
              ? pollError.message
              : "The Gmail import status could not be retrieved.",
          );
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [job, onImportCompleted]);

  useEffect(() => {
    let cancelled = false;

    setSearchForm((current) => ({ ...current, senderEmail: "" }));
    if (!searchForm.bankId) return;

    void getBankDirectoryRecord(searchForm.bankId)
      .then((bank) => {
        if (!cancelled) {
          setSearchForm((current) => ({
            ...current,
            senderEmail: bank.transactionNotificationSenderEmail ?? "",
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setError("The selected bank's sender details could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [searchForm.bankId]);

  const startImport = (searchMode: "sender" | "bank-fallback") => {
    setError(null);
    setJob(null);

    if (dateRangeError) {
      setError("The start date must be on or before the end date.");
      return;
    }

    if (!searchForm.bankId) {
      setError("Select a bank before starting an import.");
      return;
    }

    const { after, before } = localDateRangeToUnixSeconds(searchForm.fromDate, searchForm.toDate);
    setLastSearchMode(searchMode);
    setSearching(true);

    void createGmailImportJob({
      bankId: searchForm.bankId,
      name: searchForm.name.trim() || undefined,
      searchMode,
      senderEmail: searchMode === "bank-fallback" ? undefined : searchForm.senderEmail || undefined,
      after,
      before,
      subject: searchForm.subject || undefined,
      keyword: searchForm.keyword || undefined,
    })
      .then((createdJob) => {
        window.sessionStorage.setItem(activeImportJobStorageKey, createdJob.id);
        setJob(createdJob);
      })
      .catch((searchError: unknown) => {
        setError(searchError instanceof Error ? searchError.message : "Gmail search failed.");
      })
      .finally(() => setSearching(false));
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startImport("sender");
  };

  const startBroaderSearch = () => startImport("bank-fallback");
  const retryFailedImport = () => startImport(lastSearchMode);

  return (
    <section
      id="gmail-search"
      aria-labelledby="gmail-search-heading"
      className="border-line bg-card border-b px-5 py-5 sm:px-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="gmail-search-heading"
            className="text-moss text-[11px] font-bold tracking-[0.16em] uppercase"
          >
            Search Gmail
          </h2>
          <p id="gmail-search-description" className="text-muted mt-1 text-[12px]">
            Search matching messages on Gmail without loading your mailbox into the app.
          </p>
        </div>
        <button
          type="button"
          aria-controls="gmail-search-fields"
          aria-expanded={isExpanded}
          disabled={collapseDisabled}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="border-line text-muted focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExpanded ? "Hide search" : "Show search"}
          <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </div>
      {!isExpanded && job && (
        <p className="text-muted mt-3 font-mono text-[10px] tracking-[0.08em] uppercase">
          {job.name ?? "Unnamed import"} · {job.status}
        </p>
      )}
      <div id="gmail-search-fields" hidden={!isExpanded}>
        <form
          onSubmit={submitSearch}
          aria-busy={searching || importActive}
          aria-describedby={
            error
              ? dateRangeError
                ? "gmail-date-range-error"
                : "gmail-search-error"
              : "gmail-search-description"
          }
          className="mt-5 grid gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-4"
        >
        <label
          htmlFor="gmail-import-name"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          Import name <span className="text-muted/70 font-normal">(optional)</span>
          <input
            id="gmail-import-name"
            type="text"
            maxLength={100}
            value={searchForm.name}
            onChange={(event) =>
              setSearchForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="January 2026 Union Bank"
            className={inputClassName}
          />
        </label>
        <label
          htmlFor="gmail-bank"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          Bank
          <select
            id="gmail-bank"
            required
            value={searchForm.bankId}
            disabled={banksLoading || banks.length === 0}
            onChange={(event) =>
              (() => {
                const bankId = event.target.value;
                setSearchForm((current) => ({ ...current, bankId }));
              })()
            }
            className={inputClassName}
          >
            {banksLoading && <option value="">Loading banks…</option>}
            {!banksLoading && banks.length === 0 && <option value="">No banks available</option>}
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.displayName}
              </option>
            ))}
          </select>
        </label>
        <label
          htmlFor="gmail-sender-email"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold xl:col-span-2"
        >
          Sender email
          <input
            id="gmail-sender-email"
            type="email"
            required
            autoComplete="email"
            value={searchForm.senderEmail}
            onChange={(event) =>
              setSearchForm((current) => ({ ...current, senderEmail: event.target.value }))
            }
            placeholder="alerts@bank.com"
            className={inputClassName}
          />
        </label>
        <label
          htmlFor="gmail-start-date"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          Start date
          <input
            id="gmail-start-date"
            type="date"
            aria-describedby={dateRangeError ? "gmail-date-range-error" : undefined}
            aria-invalid={dateRangeError || undefined}
            value={searchForm.fromDate}
            onChange={(event) =>
              setSearchForm((current) => ({ ...current, fromDate: event.target.value }))
            }
            className={inputClassName}
          />
        </label>
        <label
          htmlFor="gmail-end-date"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          End date
          <input
            id="gmail-end-date"
            type="date"
            aria-describedby={dateRangeError ? "gmail-date-range-error" : undefined}
            aria-invalid={dateRangeError || undefined}
            value={searchForm.toDate}
            onChange={(event) =>
              setSearchForm((current) => ({ ...current, toDate: event.target.value }))
            }
            className={inputClassName}
          />
        </label>
        <label
          htmlFor="gmail-subject"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          Subject
          <input
            id="gmail-subject"
            type="text"
            value={searchForm.subject}
            onChange={(event) =>
              setSearchForm((current) => ({ ...current, subject: event.target.value }))
            }
            placeholder="Transaction alert"
            className={inputClassName}
          />
        </label>
        <label
          htmlFor="gmail-keyword"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          Keyword
          <input
            id="gmail-keyword"
            type="text"
            value={searchForm.keyword}
            onChange={(event) =>
              setSearchForm((current) => ({ ...current, keyword: event.target.value }))
            }
            placeholder="Debit or credit"
            className={inputClassName}
          />
        </label>
        <div className="flex justify-end md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            disabled={searching || importActive || banksLoading || !searchForm.bankId}
            className="focus-visible:ring-moss focus-visible:ring-offset-paper w-max rounded-none bg-white px-4 py-2.5 text-[12px] font-bold text-black transition hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
          >
            {searching
              ? "Starting Gmail import…"
              : importActive
                ? "Importing Gmail…"
                : "Search matching messages"}
          </button>
        </div>
        </form>
      {error && (
        <div
          id={dateRangeError ? "gmail-date-range-error" : "gmail-search-error"}
          role="alert"
          className="border-line bg-paper text-ink mt-3 flex items-start gap-3 border p-3 text-[12px]"
        >
          <span className="text-moss mt-0.5 shrink-0" aria-hidden="true">
            <Icon name="alert" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {job?.status === "failed" ? "Import stopped" : "Search needs attention"}
            </p>
            <p className="text-muted mt-1 leading-5">{error}</p>
            {job?.status === "failed" && (
              <button
                type="button"
                onClick={retryFailedImport}
                disabled={searching || importActive}
                className="text-ink focus-ring mt-2 font-mono text-[10px] font-bold tracking-[0.1em] uppercase underline underline-offset-4 disabled:opacity-60"
              >
                Try the import again
              </button>
            )}
          </div>
        </div>
      )}
      {job && (
        <div
          className="text-muted mt-3 text-[12px]"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="border-line border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-ink font-mono text-[10px] font-bold tracking-[0.1em] uppercase">
                  {job.name ?? "Unnamed import"}
                </p>
                <p className="text-muted mt-1 font-mono text-[10px] tracking-[0.1em] uppercase">
                  Import status / {job.status}
                </p>
              </div>
              <p className="font-mono text-[10px] tracking-[0.08em] uppercase">
                Attempt {job.attemptCount} / 3
              </p>
            </div>
            <div className="bg-line/30 mt-3 h-1" aria-hidden="true">
              <div
                className="bg-moss h-1 transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-muted mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px]">
              <span>
                {job.progress.messagesProcessed} processed / {job.progress.messagesDiscovered}{" "}
                discovered
              </span>
              <span>{messagesRemaining} remaining</span>
            </div>
            {retrySeconds > 0 && (
              <p className="text-moss mt-2 text-[11px]" role="timer">
                Temporary Gmail issue. Retrying in {retrySeconds}s.
              </p>
            )}
          </div>
          {noMatches ? (
            <p>
              No matching messages found. Adjust the sender, dates, subject, or keyword, or try a
              broader search for this bank.
              <button
                type="button"
                onClick={startBroaderSearch}
                disabled={searching || importActive}
                className="text-ink ml-1 font-bold underline underline-offset-2 disabled:opacity-60"
              >
                Try broader bank search
              </button>
            </p>
          ) : (
            <p>
              Import {job.status}: {job.progress.messagesDiscovered} message
              {job.progress.messagesDiscovered === 1 ? "" : "s"} discovered.
              {job.status === "completed" && " Message discovery is complete."}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="border-line border px-2 py-2">
              <dt className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                Messages imported
              </dt>
              <dd className="text-ink mt-1 text-[16px] font-bold">
                {job.progress.messagesProcessed}
              </dd>
            </div>
            <div className="border-line border px-2 py-2">
              <dt className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                Transactions extracted
              </dt>
              <dd className="text-ink mt-1 text-[16px] font-bold">
                {job.progress.transactionsExtracted}
              </dd>
            </div>
            <div className="border-line border px-2 py-2">
              <dt className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                Messages skipped
              </dt>
              <dd className="text-ink mt-1 text-[16px] font-bold">
                {job.progress.messagesSkipped}
              </dd>
            </div>
          </dl>
        </div>
      )}
      </div>
    </section>
  );
}
