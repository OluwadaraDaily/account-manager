import { useState } from "react";
import {
  getGmailMessageMetadata,
  searchGmailMessages,
  type GmailMessageMetadata,
  type GmailMessageSearchResult,
} from "../google/gmailAuth";
import { localDateRangeToUnixSeconds } from "../google/gmailSearch";

const inputClassName =
  "border-line bg-card text-ink focus:border-moss focus-visible:ring-moss min-w-0 rounded-[12px] border px-3 py-2.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

type SearchForm = {
  senderEmail: string;
  fromDate: string;
  toDate: string;
  subject: string;
  keyword: string;
};

export function GmailSearchForm() {
  const [searchForm, setSearchForm] = useState<SearchForm>({
    senderEmail: "",
    fromDate: "",
    toDate: "",
    subject: "",
    keyword: "",
  });
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<GmailMessageSearchResult | null>(null);
  const [messageMetadata, setMessageMetadata] = useState<GmailMessageMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const dateRangeError = Boolean(
    searchForm.fromDate && searchForm.toDate && searchForm.fromDate > searchForm.toDate,
  );

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setMessageMetadata([]);

    if (dateRangeError) {
      setError("The start date must be on or before the end date.");
      return;
    }

    const { after, before } = localDateRangeToUnixSeconds(searchForm.fromDate, searchForm.toDate);
    setSearching(true);

    void searchGmailMessages({
      senderEmail: searchForm.senderEmail || undefined,
      after,
      before,
      subject: searchForm.subject || undefined,
      keyword: searchForm.keyword || undefined,
    })
      .then(async (searchResult) => {
        setResult(searchResult);
        if (searchResult.messages.length === 0) return;

        const metadata = await getGmailMessageMetadata(
          searchResult.messages.map((message) => message.id),
        );
        setMessageMetadata(metadata.messages);
      })
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
        aria-busy={searching}
        aria-describedby={
          error
            ? dateRangeError
              ? "gmail-date-range-error"
              : "gmail-search-error"
            : "gmail-search-description"
        }
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-5"
      >
        <label
          htmlFor="gmail-sender-email"
          className="text-muted flex flex-col gap-1.5 text-[11px] font-semibold"
        >
          Sender email
          <input
            id="gmail-sender-email"
            type="email"
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
        <div className="flex flex-col justify-end md:col-span-2 lg:col-span-5">
          <button
            type="submit"
            disabled={searching}
            className="bg-ink hover:bg-moss-dark focus-visible:ring-moss focus-visible:ring-offset-paper w-full rounded-[12px] px-4 py-2.5 text-[12px] font-bold text-white transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
          >
            {searching ? "Searching Gmail…" : "Search matching messages"}
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
      {result && (
        <p
          className="text-muted mt-3 text-[12px]"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          This page returned {result.messages.length} message references
          {result.resultSizeEstimate !== undefined
            ? ` from an estimated ${result.resultSizeEstimate} matches.`
            : "."}
        </p>
      )}
      {messageMetadata.length > 0 && (
        <div className="border-line mt-4 max-h-80 overflow-y-auto rounded-[12px] border bg-white">
          <h3 className="sr-only">Matching Gmail messages</h3>
          <ul aria-label="Matching Gmail messages" className="divide-line divide-y">
            {messageMetadata.map((message) => (
              <li key={message.id} className="px-4 py-3 text-[12px]">
                <p className="text-ink font-semibold">
                  {message.headers.subject || "(No subject)"}
                </p>
                <p className="text-muted mt-1 truncate">
                  {message.headers.from || "Unknown sender"}
                  {message.headers.date ? ` · ${message.headers.date}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
