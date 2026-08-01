export type GmailSearchCriteria = {
  senderEmail?: string;
  after?: number;
  before?: number;
  subject?: string;
  keyword?: string;
};

function quoteSearchValue(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function buildGmailSearchQuery(criteria: GmailSearchCriteria) {
  return [
    criteria.senderEmail ? `from:${criteria.senderEmail}` : null,
    criteria.after !== undefined ? `after:${criteria.after}` : null,
    criteria.before !== undefined ? `before:${criteria.before}` : null,
    criteria.subject ? `subject:${quoteSearchValue(criteria.subject)}` : null,
    criteria.keyword ? quoteSearchValue(criteria.keyword) : null,
  ]
    .filter((term): term is string => term !== null)
    .join(" ");
}
