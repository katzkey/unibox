import { randomUUID } from "crypto";
import type { UnifiedMessage } from "@/types/message";

const GRAPH_API = "https://graph.instagram.com/v21.0";

interface IGConversation {
  id: string;
  participants: { data: { id: string; username: string }[] };
}

interface IGMessage {
  id: string;
  message: string;
  from: { id: string; username: string };
  created_time: string;
}

export async function fetchInstagramMessages(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  const allMessages: UnifiedMessage[] = [];

  try {
    // Get conversations
    const convRes = await fetch(
      `${GRAPH_API}/me/conversations?fields=id,participants&platform=instagram`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!convRes.ok) {
      const errorText = await convRes.text();
      console.error("Instagram conversations fetch failed:", convRes.status, errorText);
      throw new Error(`Instagram API error: ${convRes.status}`);
    }

    const convData = (await convRes.json()) as {
      data: IGConversation[];
    };

    const sinceTime = since?.getTime() ?? 0;

    for (const conv of convData.data.slice(0, 10)) {
      try {
        const msgRes = await fetch(
          `${GRAPH_API}/${conv.id}/messages?fields=id,message,from,created_time&limit=10`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgRes.ok) continue;

        const msgData = (await msgRes.json()) as {
          data: IGMessage[];
        };

        for (const msg of msgData.data) {
          if (new Date(msg.created_time).getTime() <= sinceTime) continue;

          allMessages.push({
            id: randomUUID(),
            source: "instagram",
            sourceId: msg.id,
            threadId: conv.id,
            sender: {
              id: msg.from.id,
              displayName: msg.from.username,
            },
            bodyText: msg.message || "",
            timestamp: new Date(msg.created_time),
            isRead: false,
            openUrl: "https://www.instagram.com/direct/inbox/",
            raw: msg,
          });
        }
      } catch (error) {
        console.error(`Failed to fetch Instagram conversation ${conv.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to fetch Instagram messages:", error);
  }

  return allMessages;
}

export async function refreshInstagramToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  // Instagram uses long-lived tokens that can be refreshed
  const res = await fetch(
    `${GRAPH_API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`,
  );

  if (!res.ok) {
    throw new Error(`Instagram token refresh error: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
