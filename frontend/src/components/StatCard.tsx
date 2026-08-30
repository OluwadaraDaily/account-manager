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
      marker: "bg-moss",
    },
    red: {
      card: "border-line bg-card text-ink",
      marker: "bg-line",
    },
    dark: {
      card: "border-ink bg-moss text-paper",
      marker: "bg-paper",
    },
  };
  const color = colors[tone];

  return (
    <Card className={`gap-0 rounded-none border p-0 shadow-none ${color.card}`}>
      <CardHeader className="gap-0 px-5 pt-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase opacity-75">
            {label}
          </p>
          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full opacity-80 ${color.marker}`} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-7 pb-5">
        <p className="font-mono text-[10px] font-medium tracking-[0.06em] uppercase opacity-60">
          {note}
        </p>
        <p className="font-display mt-2 text-[30px] font-bold tracking-[-0.07em]">{value}</p>
      </CardContent>
    </Card>
  );
}
