const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";
const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GMAIL_AUTH_SCOPE = "openid email profile https://www.googleapis.com/auth/gmail.readonly";

function getClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID;
}

export function loadGoogleIdentityServices() {
  if (window.google?.accounts.oauth2) return Promise.resolve();

  const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
  if (existingScript) {
    return new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Identity Services failed to load.")),
        {
          once: true,
        },
      );
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services failed to load."));
    document.head.appendChild(script);
  });
}

export async function requestGmailAccess({
  onSuccess,
  onError,
}: {
  onSuccess: (accessToken: string) => void;
  onError: (message: string) => void;
}) {
  const clientId = getClientId();

  if (!clientId) {
    onError("Gmail sign-in is not configured for this environment.");
    return;
  }

  try {
    await loadGoogleIdentityServices();
  } catch {
    onError("Gmail sign-in could not load. Check your connection and try again.");
    return;
  }

  if (!window.google?.accounts.oauth2) {
    onError("Gmail sign-in is not ready yet. Please try again in a moment.");
    return;
  }

  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GMAIL_AUTH_SCOPE,
    callback: (response) => {
      if (response.error || !response.access_token) {
        onError("Google did not authorize Gmail access. No data was imported.");
        return;
      }
      onSuccess(response.access_token);
    },
    error_callback: () => onError("The Gmail authorization window was closed or could not open."),
  });

  tokenClient.requestAccessToken({ prompt: "consent" });
}

export function revokeGmailAccess(accessToken: string | null) {
  if (!accessToken || !window.google?.accounts.oauth2.revoke) return;
  window.google.accounts.oauth2.revoke(accessToken, () => undefined);
}
