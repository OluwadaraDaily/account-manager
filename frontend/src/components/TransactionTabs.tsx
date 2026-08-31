type TransactionTabsProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  needsReviewCount: number;
  confirmedCount?: number;
};

import { playSensoryCue } from "../utils/sensoryFeedback";

export function TransactionTabs({
  activeTab,
  onTabChange,
  needsReviewCount,
  confirmedCount,
}: TransactionTabsProps) {
  const tabs = [
    { id: "Overview", label: "Overview" },
    { id: "Needs review", label: "Needs review", count: needsReviewCount },
    { id: "Confirmed", label: "Confirmed", count: confirmedCount },
  ];

  return (
    <div className="border-line flex gap-6 border-b px-5 sm:px-7">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          label={tab.label}
          active={activeTab === tab.id}
          onClick={() => {
            playSensoryCue("navigation");
            onTabChange(tab.id);
          }}
          count={tab.count}
        />
      ))}
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
      className={`relative flex min-h-11 items-center gap-2 py-4 font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      {label}
      {count ? (
        <span className="text-muted border-line bg-paper px-1.5 py-0.5 font-mono text-[10px]">
          {count}
        </span>
      ) : null}
      {active ? <span className="bg-moss absolute right-0 bottom-0 left-0 h-px" /> : null}
    </button>
  );
}
