export type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
};

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function collectTextParts(part: GmailMessagePart, mimeType: "text/plain" | "text/html") {
  const values: string[] = [];

  if (part.mimeType === mimeType && !part.filename && part.body?.data) {
    values.push(decodeBase64Url(part.body.data));
  }

  for (const child of part.parts ?? []) values.push(...collectTextParts(child, mimeType));
  return values;
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll(/&nbsp;/gi, " ")
    .replaceAll(/&amp;/gi, "&")
    .replaceAll(/&lt;/gi, "<")
    .replaceAll(/&gt;/gi, ">")
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'");
}

function htmlToText(value: string) {
  return decodeHtmlEntities(
    value
      .replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replaceAll(/<br\s*\/?>/gi, "\n")
      .replaceAll(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replaceAll(/<[^>]+>/g, "")
      .replaceAll(/\r/g, "")
      .replaceAll(/[ \t]+\n/g, "\n")
      .replaceAll(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export function extractGmailBodyText(payload: GmailMessagePart) {
  const plainText = collectTextParts(payload, "text/plain").join("\n\n").trim();
  if (plainText) return { text: plainText, source: "plain" as const };

  const htmlText = collectTextParts(payload, "text/html")
    .map(htmlToText)
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return htmlText ? { text: htmlText, source: "html" as const } : { text: null, source: null };
}
