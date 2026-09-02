import { normalizeAmount } from "../shared/utils.js";

const fieldLabels = {
  amount: ["transaction amount", "debit amount", "credit amount", "amount"],
  counterparty: ["counterparty", "merchant", "beneficiary", "recipient", "sender"],
  description: ["transaction description", "narration", "description", "details", "remarks"],
  channel: ["channel", "transaction channel", "via"],
  date: ["transaction date & time", "transaction date", "value date", "date"],
  type: ["transaction type"],
};

export function captureField(text: string, labels: string[]) {
  const pattern = new RegExp(
    `(?:^|\\n)[ \\t]*(?:${labels.join("|")})[ \\t]*[:=-][ \\t]*([^\\n]+)`,
    "i",
  );
  return text.match(pattern)?.[1]?.trim() || null;
}

export function captureAdjacentField(text: string, labels: string[]) {
  const wanted = labels.map((label) => label.toLowerCase());
  const allLabels = Object.values(fieldLabels)
    .flat()
    .map((label) => label.toLowerCase());
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!wanted.includes(lines[index].trim().toLowerCase())) continue;
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex].trim();
      if (!nextLine) continue;
      const nextLabel = nextLine
        .match(/^([^:=-]+)\s*[:=-]/)?.[1]
        ?.trim()
        .toLowerCase();
      if (nextLabel && allLabels.includes(nextLabel)) return null;
      return nextLine;
    }
  }
  return null;
}

export function parseUnionAmount(text: string) {
  const labeledValue =
    captureField(text, fieldLabels.amount) ?? captureAdjacentField(text, fieldLabels.amount);
  const source =
    labeledValue ?? text.match(/(?:NGN|₦|Naira)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i)?.[0] ?? null;
  return normalizeAmount(source);
}

export { fieldLabels };
