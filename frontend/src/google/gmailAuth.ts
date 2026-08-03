import { apiClient } from "../api/client";

const backendOrigin = apiClient.defaults.baseURL ?? "";

export type GmailSession = {
  authenticated: boolean;
  user?: {
    email: string | null;
    displayName: string | null;
  };
};

export type GmailSearchCriteria = {
  bankId?: string;
  senderEmail?: string;
  after?: number;
  before?: number;
  subject?: string;
  keyword?: string;
};

export type GmailImportCriteria = GmailSearchCriteria & {
  bankId: string;
  searchMode?: "sender" | "bank-fallback";
};

export type BankDirectoryRecord = {
  id: string;
  displayName: string;
  transactionNotificationSenderEmail: string | null;
};

export type GmailMessageSearchResult = {
  messages: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type GmailMessageMetadata = {
  id: string;
  threadId: string;
  headers: {
    from: string | null;
    subject: string | null;
    date: string | null;
  };
};

export type GmailMessageMetadataResult = {
  messages: GmailMessageMetadata[];
};

export type GmailImportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type GmailImportJob = {
  id: string;
  status: GmailImportJobStatus;
  progress: {
    messagesDiscovered: number;
    messagesProcessed: number;
    transactionsExtracted: number;
    messagesSkipped: number;
  };
  errorMessage: string | null;
};

export function startGmailAuthorization() {
  window.location.assign(`${backendOrigin}/auth/google/start`);
}

export async function getGmailSession(): Promise<GmailSession> {
  const response = await apiClient.get<GmailSession>("/auth/session");
  return response.data;
}

export async function disconnectGmail() {
  await apiClient.post("/auth/logout");
}

export async function getBankDirectoryRecord(bankId: string): Promise<BankDirectoryRecord> {
  const response = await apiClient.get<{ bank: BankDirectoryRecord }>(
    `/banks/${encodeURIComponent(bankId)}`,
  );
  return response.data.bank;
}

export async function searchGmailMessages(
  criteria: GmailSearchCriteria,
): Promise<GmailMessageSearchResult> {
  const params = new URLSearchParams();

  if (criteria.senderEmail) params.set("senderEmail", criteria.senderEmail);
  if (criteria.after !== undefined) params.set("after", String(criteria.after));
  if (criteria.before !== undefined) params.set("before", String(criteria.before));
  if (criteria.subject) params.set("subject", criteria.subject);
  if (criteria.keyword) params.set("keyword", criteria.keyword);

  const query = params.toString();
  const response = await fetch(
    `${backendOrigin}/imports/gmail/messages${query ? `?${query}` : ""}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Gmail messages could not be searched.");
  }

  return (await response.json()) as GmailMessageSearchResult;
}

export async function getGmailMessageMetadata(
  messageIds: string[],
): Promise<GmailMessageMetadataResult> {
  const response = await fetch(`${backendOrigin}/imports/gmail/messages/metadata`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageIds }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Gmail message details could not be retrieved.");
  }

  return (await response.json()) as GmailMessageMetadataResult;
}

export async function createGmailImportJob(criteria: GmailImportCriteria): Promise<GmailImportJob> {
  const response = await fetch(`${backendOrigin}/imports/gmail/jobs`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(criteria),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "The Gmail import could not be started.");
  }

  const body = (await response.json()) as { job: GmailImportJob };
  return body.job;
}

export async function getGmailImportJob(jobId: string): Promise<GmailImportJob> {
  const response = await fetch(`${backendOrigin}/imports/gmail/jobs/${encodeURIComponent(jobId)}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "The Gmail import status could not be retrieved.");
  }

  const body = (await response.json()) as { job: GmailImportJob };
  return body.job;
}
