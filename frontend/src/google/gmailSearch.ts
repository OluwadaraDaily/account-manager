function localMidnight(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function localDateRangeToUnixSeconds(from: string, to: string) {
  const after = from ? Math.floor(localMidnight(from).getTime() / 1000) - 1 : undefined;
  const endDate = to ? localMidnight(to) : null;
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const before = endDate ? Math.floor(endDate.getTime() / 1000) : undefined;

  return { after, before };
}
