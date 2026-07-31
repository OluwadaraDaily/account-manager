export {};

declare global {
  interface GoogleTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
  }

  interface GoogleTokenClient {
    requestAccessToken: (options?: { prompt?: string }) => void;
  }

  interface GoogleAccountsOAuth2 {
    initTokenClient: (options: {
      client_id: string;
      scope: string;
      callback: (response: GoogleTokenResponse) => void;
      error_callback?: (error: { type?: string; message?: string }) => void;
    }) => GoogleTokenClient;
    revoke?: (token: string, callback: () => void) => void;
  }

  interface GoogleAccounts {
    oauth2: GoogleAccountsOAuth2;
  }

  interface GoogleIdentityServices {
    accounts: GoogleAccounts;
  }

  interface Window {
    google?: GoogleIdentityServices;
  }
}
