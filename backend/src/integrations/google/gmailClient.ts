import { OAuth2Client } from "google-auth-library";
import { googleConfig } from "../../config.js";

type GmailMessageReference = {
  id: string;
  threadId: string;
};

export type GmailMessageList = {
  messages: GmailMessageReference[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessageListResponse = {
  messages?: GmailMessageReference[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type ListMessagesOptions = {
  refreshToken: string;
  pageToken?: string;
};

export async function listGmailMessages({
  refreshToken,
  pageToken,
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
