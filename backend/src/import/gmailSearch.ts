export type GmailSearchCriteria = {
  senderEmail?: string;
  bankDomains?: string[];
  bankSearchTerms?: string[];
  after?: number;
  before?: number;
  subject?: string;
  keyword?: string;
};

function quoteSearchValue(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function buildGmailSearchQuery(criteria: GmailSearchCriteria) {
  const bankTerms = [
    ...(criteria.bankDomains ?? []).map((domain) => `from:${domain}`),
    ...(criteria.bankSearchTerms ?? []).map(quoteSearchValue),
  ];

  return [
    criteria.senderEmail ? `from:${criteria.senderEmail}` : null,
    bankTerms.length > 0 ? `{${bankTerms.join(" ")}}` : null,
    criteria.after !== undefined ? `after:${criteria.after}` : null,
    criteria.before !== undefined ? `before:${criteria.before}` : null,
    criteria.subject ? `subject:${quoteSearchValue(criteria.subject)}` : null,
    criteria.keyword ? quoteSearchValue(criteria.keyword) : null,
  ]
    .filter((term): term is string => term !== null)
    .join(" ");
}
