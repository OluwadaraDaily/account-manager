type StatCardProps = {
  label: string;
  value: string;
  note: string;
  tone: "green" | "red" | "dark";
};

export function StatCard({ label, value, note, tone }: StatCardProps) {
  const colors = {
    green: "bg-[#edf6e7] text-[#5c8655]",
    red: "bg-[#fff1ef] text-[#c66b61]",
    dark: "bg-ink text-white",
  };

  return (
    <div className={`rounded-[20px] p-5 ${colors[tone]}`}>
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-semibold opacity-75">{label}</p>
        <span className="text-[11px] font-medium opacity-60">{note}</span>
      </div>
      <p className="font-display mt-8 text-[28px] font-extrabold tracking-[-0.06em]">{value}</p>
    </div>
  );
}
