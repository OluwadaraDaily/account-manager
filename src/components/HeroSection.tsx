import { Icon } from "./Icon";

type HeroSectionProps = {
  connected: boolean;
  onConnect: () => void;
};

export function HeroSection({ connected, onConnect }: HeroSectionProps) {
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
          onClick={onConnect}
          className="bg-lime text-ink mt-7 flex w-full items-center justify-between rounded-full px-5 py-3.5 text-[13px] font-bold transition hover:bg-[#e6f99b]"
        >
          {connected ? "Gmail connected" : "Connect Gmail"}
          <Icon name={connected ? "check" : "arrow"} size={17} />
        </button>
      </div>
    </section>
  );
}
