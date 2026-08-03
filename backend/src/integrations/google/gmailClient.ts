import { OAuth2Client } from "google-auth-library";
import { googleConfig } from "../../config.js";
import { extractGmailBodyText, type GmailMessagePart } from "./gmailContent.js";

type GmailMessageReference = {
  id: string;
  threadId: string;
};

export type GmailMessageList = {
  messages: GmailMessageReference[];
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

export type GmailMessageContent = GmailMessageMetadata & {
  internalDate: string | null;
  body: {
    text: string | null;
    source: "plain" | "html" | null;
  };
};

type GmailMessageListResponse = {
  messages?: GmailMessageReference[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessageMetadataResponse = {
  id: string;
  threadId: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

type GmailMessageContentResponse = {
  id: string;
  threadId: string;
  internalDate?: string;
  payload: GmailMessagePart & {
    headers?: Array<{ name: string; value: string }>;
  };
};

const retryableGmailStatuses = new Set([429, 500, 502, 503, 504]);
const maxGmailRequestAttempts = 3;
const defaultRetryDelayMs = 250;
const maxRetryDelayMs = 5_000;

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1_000, maxRetryDelayMs);
  }

  return Math.min(defaultRetryDelayMs * 2 ** (attempt - 1), maxRetryDelayMs);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGmailJson<T>(url: URL, accessToken: string, description: string) {
  for (let attempt = 1; attempt <= maxGmailRequestAttempts; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      if (attempt === maxGmailRequestAttempts) {
        throw new Error(`${description} failed after retries.`, { cause: error });
      }

      await wait(defaultRetryDelayMs * 2 ** (attempt - 1));
      continue;
    }

    if (response.ok) return (await response.json()) as T;

    if (!retryableGmailStatuses.has(response.status) || attempt === maxGmailRequestAttempts) {
      throw new Error(`${description} failed with status ${response.status}.`);
    }

    await wait(getRetryDelayMs(response, attempt));
  }

  throw new Error(`${description} failed.`);
}

type ListMessagesOptions = {
  refreshToken: string;
  pageToken?: string;
  q?: string;
};

export async function listGmailMessages({
  refreshToken,
  pageToken,
  q,
}: ListMessagesOptions): Promise<GmailMessageList> {
  const { clientId, clientSecret } = googleConfig;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth server configuration is incomplete.");
  }

  const oauthClient = new OAuth2Client(clientId, clientSecret);
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const accessToken = await oauthClient.getAccessToken();

  if (!accessToken.token) throw new Error("Google did not return an access token.");

  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", "100");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  if (q) url.searchParams.set("q", q);

  const body = await requestGmailJson<GmailMessageListResponse>(
    url,
    accessToken.token,
    "Gmail message listing",
  );

  return {
    messages: body.messages ?? [],
    ...(body.nextPageToken ? { nextPageToken: body.nextPageToken } : {}),
    ...(body.resultSizeEstimate !== undefined
      ? { resultSizeEstimate: body.resultSizeEstimate }
      : {}),
  };
}

type GetMessageMetadataOptions = {
  refreshToken: string;
  messageId: string;
};

export async function getGmailMessageMetadata({
  refreshToken,
  messageId,
}: GetMessageMetadataOptions): Promise<GmailMessageMetadata> {
  const { clientId, clientSecret } = googleConfig;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth server configuration is incomplete.");
  }

  const oauthClient = new OAuth2Client(clientId, clientSecret);
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const accessToken = await oauthClient.getAccessToken();

  if (!accessToken.token) throw new Error("Google did not return an access token.");

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
  );
  url.searchParams.set("format", "metadata");
  url.searchParams.append("metadataHeaders", "From");
  url.searchParams.append("metadataHeaders", "Subject");
  url.searchParams.append("metadataHeaders", "Date");

  const body = await requestGmailJson<GmailMessageMetadataResponse>(
    url,
    accessToken.token,
    "Gmail message metadata retrieval",
  );
  const headers = new Map(
    (body.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
  );

  return {
    id: body.id,
    threadId: body.threadId,
    headers: {
      from: headers.get("from") ?? null,
      subject: headers.get("subject") ?? null,
      date: headers.get("date") ?? null,
    },
  };
}

type GetMessageContentOptions = {
  refreshToken: string;
  messageId: string;
};

export async function getGmailMessageContent({
  refreshToken,
  messageId,
}: GetMessageContentOptions): Promise<GmailMessageContent> {
  const { clientId, clientSecret } = googleConfig;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth server configuration is incomplete.");
  }

  const oauthClient = new OAuth2Client(clientId, clientSecret);
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const accessToken = await oauthClient.getAccessToken();

  if (!accessToken.token) throw new Error("Google did not return an access token.");

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
  );
  url.searchParams.set("format", "full");

  const body = await requestGmailJson<GmailMessageContentResponse>(
    url,
    accessToken.token,
    "Gmail message content retrieval",
  );
  const headers = new Map(
    (body.payload.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
  );

  return {
    id: body.id,
    threadId: body.threadId,
    internalDate: body.internalDate ?? null,
    headers: {
      from: headers.get("from") ?? null,
      subject: headers.get("subject") ?? null,
      date: headers.get("date") ?? null,
    },
    body: extractGmailBodyText(body.payload),
  };
}
