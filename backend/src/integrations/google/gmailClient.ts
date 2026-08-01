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

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken.token}` },
  });

  if (!response.ok) {
    throw new Error(`Gmail message listing failed with status ${response.status}.`);
  }

  const body = (await response.json()) as GmailMessageListResponse;

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

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken.token}` },
  });

  if (!response.ok) {
    throw new Error(`Gmail message metadata retrieval failed with status ${response.status}.`);
  }

  const body = (await response.json()) as GmailMessageMetadataResponse;
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

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken.token}` },
  });

  if (!response.ok) {
    throw new Error(`Gmail message content retrieval failed with status ${response.status}.`);
  }

  const body = (await response.json()) as GmailMessageContentResponse;
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
