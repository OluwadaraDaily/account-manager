type TransactionTabsProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  needsReviewCount: number;
};

export function TransactionTabs({
  activeTab,
  onTabChange,
  needsReviewCount,
}: TransactionTabsProps) {
  return (
    <div className="border-line flex gap-6 border-b px-5 sm:px-7">
      <Tab
        label="Overview"
        active={activeTab === "Overview"}
        onClick={() => onTabChange("Overview")}
      />
      <Tab
        label="Needs review"
        active={activeTab === "Needs review"}
        onClick={() => onTabChange("Needs review")}
        count={needsReviewCount}
      />
    </div>
  );
}

function Tab({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 py-4 text-[12px] font-bold transition ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      {label}
      {count ? (
        <span className="text-muted rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
          {count}
        </span>
      ) : null}
      {active ? (
        <span className="bg-moss absolute right-0 bottom-0 left-0 h-0.5 rounded-full" />
      ) : null}
    </button>
  );
}
