const backendOrigin = (import.meta.env.VITE_BACKEND_ORIGIN ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);

export type GmailSession = {
  authenticated: boolean;
  user?: {
    email: string | null;
    displayName: string | null;
  };
};

export type GmailSearchCriteria = {
  senderEmail?: string;
  after?: number;
  before?: number;
  subject?: string;
  keyword?: string;
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

export function startGmailAuthorization() {
  window.location.assign(`${backendOrigin}/auth/google/start`);
}

export async function getGmailSession(): Promise<GmailSession> {
  const response = await fetch(`${backendOrigin}/auth/session`, {
    credentials: "include",
  });

  if (!response.ok) throw new Error("The Gmail session could not be checked.");
  return (await response.json()) as GmailSession;
}

export async function disconnectGmail() {
  const response = await fetch(`${backendOrigin}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) throw new Error("Gmail could not be disconnected.");
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
