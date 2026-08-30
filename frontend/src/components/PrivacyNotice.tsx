import { Icon } from "./Icon";

export function PrivacyNotice() {
  return (
    <section className="border-line bg-card text-muted mt-5 flex flex-col justify-between gap-4 border px-5 py-4 text-[12px] sm:flex-row sm:items-center sm:px-6">
      <div className="flex items-start gap-3">
        <span className="text-moss mt-0.5">
          <Icon name="shield" size={17} />
        </span>
        <p>
          <span className="text-ink font-mono text-[10px] font-bold tracking-[0.1em] uppercase">
            Privacy by design.
          </span>{" "}
          Emails are read and processed in your browser. Nothing is saved to our servers.
        </p>
      </div>
      <button className="text-ink font-mono text-[10px] font-bold tracking-[0.1em] whitespace-nowrap uppercase underline underline-offset-4">
        How it works
      </button>
    </section>
  );
}
