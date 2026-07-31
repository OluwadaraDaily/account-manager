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
