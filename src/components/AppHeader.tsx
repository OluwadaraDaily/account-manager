import { Icon } from "./Icon";

export function AppHeader() {
  return (
    <header className="border-line bg-paper/95 border-b">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="bg-ink text-lime flex h-9 w-9 items-center justify-center rounded-[11px]">
            <Icon name="spark" size={19} />
          </div>
          <span className="font-display text-[17px] font-extrabold tracking-[-0.03em]">
            account manager
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-muted hidden items-center gap-2 text-[12px] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#a8c379]" /> Local-only mode
          </div>
          <button className="border-line bg-card text-ink hover:border-ink rounded-full border px-4 py-2 text-[13px] font-semibold transition">
            Help
          </button>
        </div>
      </div>
    </header>
  );
}
