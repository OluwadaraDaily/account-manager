import { Card, CardContent, CardHeader } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string;
  note: string;
  tone: "green" | "red" | "dark";
};

export function StatCard({ label, value, note, tone }: StatCardProps) {
  const colors = {
    green: {
      card: "border-line bg-card text-ink",
      marker: "bg-white",
    },
    red: {
      card: "border-line bg-[#171719] text-ink",
      marker: "bg-zinc-500",
    },
    dark: {
      card: "border-white bg-white text-black",
      marker: "bg-black",
    },
  };
  const color = colors[tone];

  return (
    <Card className={`gap-0 rounded-[20px] border p-0 shadow-none ${color.card}`}>
      <CardHeader className="gap-0 px-5 pt-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] font-semibold opacity-75">{label}</p>
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full opacity-80 ${color.marker}`} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-7 pb-5">
        <p className="text-[11px] font-medium opacity-60">{note}</p>
        <p className="font-display mt-2 text-[28px] font-extrabold tracking-[-0.06em]">{value}</p>
      </CardContent>
    </Card>
  );
}
