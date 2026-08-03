import { useEffect, useState } from "react";
import { bankDirectoryEntries } from "../data/bankDirectory";
import {
  createGmailImportJob,
  getBankDirectoryRecord,
  getGmailImportJob,
  type GmailImportJob,
} from "../google/gmailAuth";
import { localDateRangeToUnixSeconds } from "../google/gmailSearch";

const inputClassName =
  "border-line bg-card text-ink focus:border-moss focus-visible:ring-moss min-w-0 rounded-[12px] border px-3 py-2.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

type SearchForm = {
  bankId: string;
  senderEmail: string;
  fromDate: string;
  toDate: string;
  subject: string;
  keyword: string;
};

export function GmailSearchForm() {
  const [searchForm, setSearchForm] = useState<SearchForm>({
    bankId: "union-bank",
    senderEmail: "",
    fromDate: "",
    toDate: "",
    subject: "",
    keyword: "",
  });
  const [searching, setSearching] = useState(false);
  const [job, setJob] = useState<GmailImportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateRangeError = Boolean(
    searchForm.fromDate && searchForm.toDate && searchForm.fromDate > searchForm.toDate,
  );
  const importActive = job !== null && ["queued", "running"].includes(job.status);
  const noMatches = job?.status === "completed" && job.progress.messagesDiscovered === 0;

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
        } else if (nextJob.status === "failed") {
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
  }, [job]);

  useEffect(() => {
    let cancelled = false;

    setSearchForm((current) => ({ ...current, senderEmail: "" }));
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

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setJob(null);

    if (dateRangeError) {
      setError("The start date must be on or before the end date.");
      return;
    }

    const { after, before } = localDateRangeToUnixSeconds(searchForm.fromDate, searchForm.toDate);
    setSearching(true);

    void createGmailImportJob({
      bankId: searchForm.bankId,
      senderEmail: searchForm.senderEmail || undefined,
      after,
      before,
      subject: searchForm.subject || undefined,
      keyword: searchForm.keyword || undefined,
    })
      .then((createdJob) => setJob(createdJob))
      .catch((searchError: unknown) => {
        setError(searchError instanceof Error ? searchError.message : "Gmail search failed.");
      })
      .finally(() => setSearching(false));
  };

  return (
    <section
      aria-labelledby="gmail-search-heading"
      className="border-line border-b bg-[#fafcf9] px-5 py-5 sm:px-7"
    >
      <div className="mb-4">
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
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"
      >
        <label
          htmlFor="gmail-bank"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          Bank
          <select
            id="gmail-bank"
            required
            value={searchForm.bankId}
            onChange={(event) =>
              setSearchForm((current) => ({ ...current, bankId: event.target.value }))
            }
            className={inputClassName}
          >
            {bankDirectoryEntries.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.displayName}
              </option>
            ))}
          </select>
        </label>
        <label
          htmlFor="gmail-sender-email"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
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
        <div className="flex flex-col justify-end md:col-span-2 lg:col-span-6">
          <button
            type="submit"
            disabled={searching || importActive}
            className="bg-ink hover:bg-moss-dark focus-visible:ring-moss focus-visible:ring-offset-paper w-full rounded-[12px] px-4 py-2.5 text-[12px] font-bold text-white transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
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
        <p
          id={dateRangeError ? "gmail-date-range-error" : "gmail-search-error"}
          role="alert"
          className="mt-3 text-[12px] text-[#b34f42]"
        >
          {error}
        </p>
      )}
      {job && (
        <p
          className="text-muted mt-3 text-[12px]"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {noMatches ? (
            "No matching messages found. Adjust the sender, dates, subject, or keyword and try again."
          ) : (
            <>
              Import {job.status}: {job.progress.messagesDiscovered} message
              {job.progress.messagesDiscovered === 1 ? "" : "s"} discovered.
              {job.status === "completed" && " Message discovery is complete."}
            </>
          )}
        </p>
      )}
    </section>
  );
}
