import { useState } from "react";
import { Icon } from "./Icon";
import { requestGmailAccess, revokeGmailAccess } from "../google/gmailAuth";
import { GmailImportProgress, importRecentGmailMessages } from "../google/gmailApi";

export function HeroSection() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<GmailImportProgress | null>(null);

  const connectGmail = () => {
    setError(null);
    setConnecting(true);
    void requestGmailAccess({
      onSuccess: (token) => {
        setAccessToken(token);
        setConnected(true);
        setConnecting(false);
      },
      onError: (message) => {
        setConnecting(false);
        setError(message);
      },
    });
  };

  const disconnectGmail = () => {
    setImporting(false);
    setImportProgress(null);
    setImportError(null);
    revokeGmailAccess(accessToken);
    setAccessToken(null);
    setConnected(false);
    setError(null);
  };

  const importGmail = () => {
    if (!accessToken) return;

    setImporting(true);
    setImportError(null);
    setImportProgress(null);
    void importRecentGmailMessages(accessToken, setImportProgress)
      .catch(() => {
        setImportError("Gmail import could not be completed. No message content was saved.");
      })
      .finally(() => setImporting(false));
  };

  return (
    <section className="border-line grid gap-8 border-b py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-16">
      <div>
        <div className="text-moss-dark mb-5 inline-flex items-center gap-2 rounded-full border border-[#dbe7ce] bg-[#eff5e8] px-3 py-1.5 text-[12px] font-semibold">
          <Icon name="shield" size={14} /> Your data stays with you
        </div>
        <h1 className="font-display max-w-[720px] text-[clamp(2.7rem,6vw,5.65rem)] leading-[0.99] font-extrabold tracking-[-0.075em]">
          See your money
          <br />
          <span className="text-moss">clearly.</span>
        </h1>
        <p className="text-muted mt-6 max-w-[560px] text-[16px] leading-7">
          Turn transaction emails into a clean, useful view of your finances. No bank passwords. No
          data stored on our servers.
        </p>
      </div>
      <div className="bg-ink rounded-[24px] p-6 text-white shadow-[0_22px_50px_rgba(24,33,29,0.12)] lg:ml-auto lg:max-w-[430px]">
        <div className="mb-10 flex items-start justify-between">
          <div className="text-lime rounded-full bg-white/10 p-3">
            <Icon name="mail" size={21} />
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/65">
            MVP preview
          </span>
        </div>
        <p className="font-display max-w-[300px] text-[22px] leading-8 font-bold tracking-[-0.04em]">
          Connect once. Understand more.
        </p>
        <p className="mt-3 text-[13px] leading-6 text-white/55">
          Read-only Gmail access, local processing, and a spreadsheet you control.
        </p>
        <button
          onClick={connected ? disconnectGmail : connectGmail}
          disabled={connecting}
          className="bg-lime text-ink mt-7 flex w-full items-center justify-between rounded-full px-5 py-3.5 text-[13px] font-bold transition hover:bg-[#e6f99b]"
        >
          {connecting ? "Connecting…" : connected ? "Disconnect Gmail" : "Connect Gmail"}
          <Icon name={connected ? "check" : "arrow"} size={17} />
        </button>
        {error && <p className="mt-3 text-[12px] leading-5 text-[#ffb4a8]">{error}</p>}
        {connected && (
          <div className="mt-5 border-t border-white/10 pt-5">
            <button
              onClick={importGmail}
              disabled={importing}
              className="flex w-full items-center justify-between rounded-full border border-white/20 px-5 py-3 text-[13px] font-semibold text-white transition hover:border-white/50 disabled:cursor-wait disabled:opacity-60"
            >
              {importing ? "Importing recent Gmail…" : "Import recent Gmail"}
              <Icon name="arrow" size={17} />
            </button>
            {importProgress && (
              <p className="mt-3 text-[12px] leading-5 text-white/60">
                {importing
                  ? importProgress.estimatedMessages &&
                    importProgress.retrievedMessages < importProgress.estimatedMessages
                    ? `Read ${importProgress.retrievedMessages} of approximately ${importProgress.estimatedMessages} messages`
                    : `Read ${importProgress.retrievedMessages} messages`
                  : `Imported ${importProgress.retrievedMessages} messages; ${importProgress.readableMessages} had readable bodies${importProgress.skippedMessages ? `, ${importProgress.skippedMessages} skipped` : ""}.`}
              </p>
            )}
            {importError && (
              <p className="mt-3 text-[12px] leading-5 text-[#ffb4a8]">{importError}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
