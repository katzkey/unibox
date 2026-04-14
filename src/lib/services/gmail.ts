import { randomUUID } from "crypto";
import type { UnifiedMessage, Attachment } from "@/types/message";

const GMAIL_API = "https://www.googleapis.com/gmail/v1/users/me";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType: string;
  filename?: string;
  body: { size: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
  headers?: GmailHeader[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  internalDate: string;
  payload: {
    headers: GmailHeader[];
    mimeType: string;
    body: { size: number; data?: string };
    parts?: GmailPart[];
  };
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
}

export async function fetchGmailMessages(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  // Build query: fetch messages after the given date
  let query = "in:inbox";
  if (since) {
    const epoch = Math.floor(since.getTime() / 1000);
    query += ` after:${epoch}`;
  }

  // List message IDs
  const listUrl = new URL(`${GMAIL_API}/messages`);
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", "50");

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errorText = await listRes.text();
    console.error("Gmail list messages failed:", listRes.status, errorText);
    throw new Error(`Gmail API error: ${listRes.status}`);
  }

  const listData = (await listRes.json()) as GmailListResponse;

  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  // Fetch message details with bounded concurrency to avoid 429 rate limits.
  const CONCURRENCY = 5;
  const ids = listData.messages.map((m) => m.id);
  const messages: GmailMessage[] = [];

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((id) => fetchGmailMessage(accessToken, id))
    );
    messages.push(...results);
  }

  return messages.map(normalizeGmailMessage);
}

async function fetchGmailMessage(
  accessToken: string,
  messageId: string,
  retries = 3
): Promise<GmailMessage> {
  const res = await fetch(
    `${GMAIL_API}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  // Retry with exponential backoff on 429 (rate limit) and 5xx.
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    const backoffMs = (4 - retries) * 500 + Math.random() * 300;
    await new Promise((r) => setTimeout(r, backoffMs));
    return fetchGmailMessage(accessToken, messageId, retries - 1);
  }

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Gmail get message failed:", res.status, errorText);
    throw new Error(`Gmail API error: ${res.status}`);
  }

  return (await res.json()) as GmailMessage;
}

function normalizeGmailMessage(msg: GmailMessage): UnifiedMessage {
  const headers = msg.payload.headers;
  const getHeader = (name: string): string =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = getHeader("From");
  const { name: senderName, email: senderEmail } = parseFromHeader(from);

  const { text, html } = extractBody(msg.payload);
  const attachments = extractAttachments(msg.payload, msg.id);

  return {
    id: randomUUID(),
    source: "gmail",
    sourceId: msg.id,
    threadId: msg.threadId,
    sender: {
      id: senderEmail,
      displayName: senderName || senderEmail,
    },
    subject: getHeader("Subject") || undefined,
    bodyText: text,
    bodyHtml: html || undefined,
    timestamp: new Date(parseInt(msg.internalDate, 10)),
    isRead: !msg.labelIds.includes("UNREAD"),
    openUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
    attachments: attachments.length > 0 ? attachments : undefined,
    raw: msg,
  };
}

function parseFromHeader(from: string): { name: string; email: string } {
  // Format: "Display Name <email@example.com>" or "email@example.com"
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, ""), email: match[2] };
  }
  return { name: "", email: from };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

function extractBody(payload: GmailPart): { text: string; html: string } {
  let text = "";
  let html = "";

  function walk(part: GmailPart) {
    if (part.mimeType === "text/plain" && part.body.data && !text) {
      text = decodeBase64Url(part.body.data);
    }
    if (part.mimeType === "text/html" && part.body.data && !html) {
      html = decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return { text, html };
}

function extractAttachments(
  payload: GmailPart,
  messageId: string
): Attachment[] {
  const attachments: Attachment[] = [];

  function walk(part: GmailPart) {
    if (part.filename && part.body.attachmentId) {
      attachments.push({
        name: part.filename,
        url: `${GMAIL_API}/messages/${messageId}/attachments/${part.body.attachmentId}`,
        mimeType: part.mimeType,
        size: part.body.size,
      });
    }
    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return attachments;
}

export async function refreshGmailToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Gmail token refresh failed:", res.status, errorText);
    throw new Error(`Gmail token refresh error: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
