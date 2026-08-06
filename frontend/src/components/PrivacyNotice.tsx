import { Icon } from "./Icon";

export function PrivacyNotice() {
  return (
    <section className="border-line bg-card text-muted mt-5 flex flex-col justify-between gap-4 rounded-[20px] border px-5 py-4 text-[12px] sm:flex-row sm:items-center sm:px-6">
      <div className="flex items-start gap-3">
        <Icon name="shield" size={17} />
        <p>
          <span className="text-ink font-bold">Privacy by design.</span> Emails are read and
          processed in your browser. Nothing is saved to our servers.
        </p>
      </div>
      <button className="text-ink font-bold whitespace-nowrap underline underline-offset-4">
        How it works
      </button>
    </section>
  );
}
