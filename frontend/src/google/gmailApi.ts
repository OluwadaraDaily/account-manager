const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

export type GmailMessageReference = {
  id: string;
  threadId?: string;
};

export type GmailMessagePage = {
  messages: GmailMessageReference[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type GmailMessageHeader = {
  name: string;
  value: string;
};

export type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: {
    data?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
};

export type GmailMessageDetail = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

export type DecodedGmailBody = {
  plainText: string;
  html: string;
};

export type GmailImportProgress = {
  pages: number;
  listedMessages: number;
  retrievedMessages: number;
  readableMessages: number;
  skippedMessages: number;
  estimatedMessages?: number;
};

type ListMessagesOptions = {
  maxResults?: number;
  pageToken?: string;
  query?: string;
};

export async function listGmailMessages(
  accessToken: string,
  { maxResults = 25, pageToken, query }: ListMessagesOptions = {},
): Promise<GmailMessagePage> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  if (query) params.set("q", query);

  const response = await fetch(`${GMAIL_MESSAGES_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Gmail could not return the message list.");
  }

  const data = (await response.json()) as {
    messages?: GmailMessageReference[];
    nextPageToken?: string;
    resultSizeEstimate?: number;
  };

  return {
    messages: data.messages ?? [],
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate,
  };
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageDetail> {
  const params = new URLSearchParams({
    format: "full",
    fields: "id,threadId,internalDate,payload",
  });
  const response = await fetch(
    `${GMAIL_MESSAGES_URL}/${encodeURIComponent(messageId)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Gmail could not return this message.");
  }

  return (await response.json()) as GmailMessageDetail;
}

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeGmailBody(message: GmailMessageDetail): DecodedGmailBody {
  const body: DecodedGmailBody = { plainText: "", html: "" };
  const parts = message.payload ? [message.payload] : [];

  while (parts.length > 0) {
    const part = parts.shift();
    if (!part) continue;

    if (part.body?.data && (part.mimeType === "text/plain" || part.mimeType === "text/html")) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain" && !body.plainText) body.plainText = decoded;
      if (part.mimeType === "text/html" && !body.html) body.html = decoded;
    }

    if (part.parts) parts.push(...part.parts);
  }

  return body;
}

export async function importRecentGmailMessages(
  accessToken: string,
  onProgress: (progress: GmailImportProgress) => void,
): Promise<GmailImportProgress> {
  let pageToken: string | undefined;
  let progress: GmailImportProgress = {
    pages: 0,
    listedMessages: 0,
    retrievedMessages: 0,
    readableMessages: 0,
    skippedMessages: 0,
  };

  do {
    const page = await listGmailMessages(accessToken, {
      maxResults: 25,
      pageToken,
      query: "newer_than:30d",
    });

    progress = {
      ...progress,
      pages: progress.pages + 1,
      listedMessages: progress.listedMessages + page.messages.length,
      estimatedMessages: page.resultSizeEstimate,
    };
    onProgress(progress);

    for (const message of page.messages) {
      const detail = await getGmailMessage(accessToken, message.id);
      const body = decodeGmailBody(detail);
      const hasReadableBody = Boolean(body.plainText || body.html);

      progress = {
        ...progress,
        retrievedMessages: progress.retrievedMessages + 1,
        readableMessages: progress.readableMessages + (hasReadableBody ? 1 : 0),
        skippedMessages: progress.skippedMessages + (hasReadableBody ? 0 : 1),
      };
      onProgress(progress);
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  return progress;
}
