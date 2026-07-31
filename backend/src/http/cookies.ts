import { appConfig } from "../config.js";

export function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (appConfig.secureCookies) attributes.push("Secure");
  return attributes.join("; ");
}

export function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>();

  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}
