import { useState } from "react";

type Transaction = {
  date: string;
  description: string;
  counterparty: string;
  type: "Debit" | "Credit";
  amount: string;
  status: "Matched" | "Review";
};

const transactions: Transaction[] = [
  { date: "28 Jun 2024", description: "POS PURCHASE", counterparty: "Shoprite Ikeja", type: "Debit", amount: "₦24,850.00", status: "Matched" },
  { date: "27 Jun 2024", description: "TRANSFER IN", counterparty: "John Doe", type: "Credit", amount: "₦150,000.00", status: "Matched" },
  { date: "25 Jun 2024", description: "USSD TRANSFER", counterparty: "DSTV Nigeria", type: "Debit", amount: "₦37,000.00", status: "Matched" },
  { date: "24 Jun 2024", description: "ATM WITHDRAWAL", counterparty: "Union Bank ATM", type: "Debit", amount: "₦50,000.00", status: "Review" },
  { date: "21 Jun 2024", description: "TRANSFER IN", counterparty: "Salary / Acme Ltd", type: "Credit", amount: "₦480,000.00", status: "Matched" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.5-3.5" /></svg>;
  if (name === "mail") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
  if (name === "filter") return <svg {...common}><path d="M4 6h16M7 12h10m-7 6h4" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 9h18" /></svg>;
  if (name === "chevron") return <svg {...common}><path d="m7 9 5 5 5-5" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "spark") return <svg {...common}><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></svg>;
  return null;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [period, setPeriod] = useState("Last 30 days");
  const [activeTab, setActiveTab] = useState("Overview");

  const downloadCsv = () => {
    const header = "Date,Description,Counterparty,Type,Amount,Status";
    const rows = transactions.map((item) => [item.date, item.description, item.counterparty, item.type, item.amount, item.status].map((value) => `"${value}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "account-manager-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-ink text-lime">
              <Icon name="spark" size={19} />
            </div>
            <span className="font-display text-[17px] font-extrabold tracking-[-0.03em]">account manager</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-[12px] text-muted sm:flex"><span className="h-2 w-2 rounded-full bg-[#a8c379]" /> Local-only mode</div>
            <button className="rounded-full border border-line bg-card px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-ink">Help</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 pb-16 lg:px-10">
        <section className="grid gap-8 border-b border-line py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dbe7ce] bg-[#eff5e8] px-3 py-1.5 text-[12px] font-semibold text-moss-dark"><Icon name="shield" size={14} /> Your data stays with you</div>
            <h1 className="max-w-[720px] font-display text-[clamp(2.7rem,6vw,5.65rem)] font-extrabold leading-[0.99] tracking-[-0.075em]">See your money<br /><span className="text-moss">clearly.</span></h1>
            <p className="mt-6 max-w-[560px] text-[16px] leading-7 text-muted">Turn transaction emails into a clean, useful view of your finances. No bank passwords. No data stored on our servers.</p>
          </div>
          <div className="rounded-[24px] bg-ink p-6 text-white shadow-[0_22px_50px_rgba(24,33,29,0.12)] lg:ml-auto lg:max-w-[430px]">
            <div className="mb-10 flex items-start justify-between"><div className="rounded-full bg-white/10 p-3 text-lime"><Icon name="mail" size={21} /></div><span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/65">MVP preview</span></div>
            <p className="max-w-[300px] font-display text-[22px] font-bold leading-8 tracking-[-0.04em]">Connect once. Understand more.</p>
            <p className="mt-3 text-[13px] leading-6 text-white/55">Read-only Gmail access, local processing, and a spreadsheet you control.</p>
            <button onClick={() => setConnected(true)} className="mt-7 flex w-full items-center justify-between rounded-full bg-lime px-5 py-3.5 text-[13px] font-bold text-ink transition hover:bg-[#e6f99b]">{connected ? "Gmail connected" : "Connect Gmail"}<Icon name={connected ? "check" : "arrow"} size={17} /></button>
          </div>
        </section>

        <section className="py-10">
          <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-moss">Your account snapshot</p><h2 className="font-display text-3xl font-extrabold tracking-[-0.055em]">Union Bank</h2></div>
            <div className="flex items-center gap-3"><label htmlFor="period" className="text-[12px] text-muted">Showing</label><div className="relative"><select id="period" value={period} onChange={(event) => setPeriod(event.target.value)} className="appearance-none rounded-full border border-line bg-card py-2.5 pl-4 pr-10 text-[12px] font-semibold outline-none focus:border-moss"><option>Last 7 days</option><option>Last 30 days</option><option>Last 365 days</option></select><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"><Icon name="chevron" size={15} /></span></div></div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Total inflow" value="₦630,000" note="2 credits" tone="green" />
            <Stat label="Total outflow" value="₦111,850" note="3 debits" tone="red" />
            <Stat label="Net movement" value="₦518,150" note="This period" tone="dark" />
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-line bg-card">
          <div className="flex flex-col justify-between gap-5 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:px-7">
            <div><h2 className="font-display text-[20px] font-extrabold tracking-[-0.04em]">Transactions</h2><p className="mt-1 text-[12px] text-muted">5 transactions found in {period.toLowerCase()}</p></div>
            <div className="flex gap-2"><button className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[12px] font-semibold text-muted transition hover:border-ink hover:text-ink"><Icon name="filter" size={15} /> Filter</button><button onClick={downloadCsv} className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-moss-dark"><Icon name="download" size={15} /> Export CSV</button></div>
          </div>
          <div className="flex gap-6 border-b border-line px-5 sm:px-7"><Tab label="Overview" active={activeTab === "Overview"} onClick={() => setActiveTab("Overview")} /><Tab label="Needs review" active={activeTab === "Needs review"} onClick={() => setActiveTab("Needs review")} count={1} /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-line text-[10px] font-bold uppercase tracking-[0.13em] text-muted"><th className="px-5 py-4 font-semibold sm:px-7">Date</th><th className="px-3 py-4 font-semibold">Description</th><th className="px-3 py-4 font-semibold">Counterparty</th><th className="px-3 py-4 font-semibold">Type</th><th className="px-3 py-4 text-right font-semibold">Amount</th><th className="px-5 py-4 text-right font-semibold sm:px-7">Status</th></tr></thead><tbody>{transactions.filter((item) => activeTab === "Overview" || item.status === "Review").map((item) => <tr key={`${item.date}-${item.description}`} className="border-b border-line/70 last:border-0"><td className="px-5 py-5 text-[12px] text-muted sm:px-7">{item.date}</td><td className="px-3 py-5 text-[13px] font-semibold">{item.description}</td><td className="px-3 py-5 text-[13px] text-muted">{item.counterparty}</td><td className="px-3 py-5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.type === "Credit" ? "bg-[#edf6e7] text-[#5c8655]" : "bg-[#fff1ef] text-[#c66b61]"}`}>{item.type}</span></td><td className={`px-3 py-5 text-right text-[13px] font-bold ${item.type === "Credit" ? "text-[#5c8655]" : "text-ink"}`}>{item.type === "Credit" ? "+" : "−"}{item.amount}</td><td className="px-5 py-5 text-right sm:px-7"><span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${item.status === "Review" ? "text-[#c18b47]" : "text-moss"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "Review" ? "bg-[#e6b568]" : "bg-[#9ec978]"}`} />{item.status}</span></td></tr>)}</tbody></table>
          </div>
        </section>

        <section className="mt-5 flex flex-col justify-between gap-4 rounded-[20px] border border-[#dbe7ce] bg-[#eff5e8] px-5 py-4 text-[12px] text-moss-dark sm:flex-row sm:items-center sm:px-6"><div className="flex items-start gap-3"><Icon name="shield" size={17} /><p><span className="font-bold">Privacy by design.</span> Emails are read and processed in your browser. Nothing is saved to our servers.</p></div><button className="whitespace-nowrap font-bold underline underline-offset-4">How it works</button></section>
      </main>
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone: "green" | "red" | "dark" }) {
  const colors = { green: "bg-[#edf6e7] text-[#5c8655]", red: "bg-[#fff1ef] text-[#c66b61]", dark: "bg-ink text-white" };
  return <div className={`rounded-[20px] p-5 ${colors[tone]}`}><div className="flex items-start justify-between"><p className="text-[12px] font-semibold opacity-75">{label}</p><span className="text-[11px] font-medium opacity-60">{note}</span></div><p className="mt-8 font-display text-[28px] font-extrabold tracking-[-0.06em]">{value}</p></div>;
}

function Tab({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return <button onClick={onClick} className={`relative flex items-center gap-2 py-4 text-[12px] font-bold transition ${active ? "text-ink" : "text-muted hover:text-ink"}`}>{label}{count ? <span className="rounded-full bg-[#fff1ef] px-1.5 py-0.5 text-[10px] text-[#c66b61]">{count}</span> : null}{active ? <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-moss" /> : null}</button>;
}

export default App;
