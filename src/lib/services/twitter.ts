import { randomUUID } from "crypto";
import type { UnifiedMessage } from "@/types/message";

const TWITTER_API = "https://api.twitter.com/2";

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  conversation_id?: string;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

interface TwitterDM {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
  dm_conversation_id: string;
}

export async function fetchTwitterMessages(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  const allMessages: UnifiedMessage[] = [];

  // Fetch mentions timeline
  try {
    const mentions = await fetchMentions(accessToken, since);
    allMessages.push(...mentions);
  } catch (error) {
    console.error("Failed to fetch Twitter mentions:", error);
  }

  // Fetch DMs
  try {
    const dms = await fetchDirectMessages(accessToken, since);
    allMessages.push(...dms);
  } catch (error) {
    console.error("Failed to fetch Twitter DMs:", error);
  }

  return allMessages;
}

async function fetchMentions(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  // Get authenticated user ID
  const meRes = await fetch(`${TWITTER_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!meRes.ok) {
    throw new Error(`Twitter API error: ${meRes.status}`);
  }

  const meData = (await meRes.json()) as { data: { id: string } };
  const userId = meData.data.id;

  const params = new URLSearchParams({
    max_results: "50",
    "tweet.fields": "created_at,author_id,conversation_id",
    expansions: "author_id",
    "user.fields": "name,username,profile_image_url",
  });

  if (since) {
    params.set("start_time", since.toISOString());
  }

  const res = await fetch(
    `${TWITTER_API}/users/${userId}/mentions?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Twitter mentions fetch failed:", res.status, errorText);
    throw new Error(`Twitter API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: TwitterTweet[];
    includes?: { users?: TwitterUser[] };
  };

  if (!data.data) return [];

  const userMap = new Map<string, TwitterUser>();
  for (const user of data.includes?.users ?? []) {
    userMap.set(user.id, user);
  }

  return data.data.map((tweet) => {
    const author = userMap.get(tweet.author_id);
    return {
      id: randomUUID(),
      source: "x" as const,
      sourceId: tweet.id,
      threadId: tweet.conversation_id,
      sender: {
        id: tweet.author_id,
        displayName: author?.name ?? tweet.author_id,
        avatarUrl: author?.profile_image_url,
      },
      bodyText: tweet.text,
      timestamp: new Date(tweet.created_at),
      isRead: false,
      openUrl: `https://x.com/i/status/${tweet.id}`,
      raw: tweet,
    };
  });
}

async function fetchDirectMessages(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  const params = new URLSearchParams({
    max_results: "50",
    "dm_event.fields": "created_at,sender_id,dm_conversation_id",
    event_types: "MessageCreate",
  });

  const res = await fetch(
    `${TWITTER_API}/dm_events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    // DM access may not be available on free tier
    if (res.status === 403) {
      console.error("Twitter DM access not available (API tier limitation)");
      return [];
    }
    throw new Error(`Twitter DM API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: TwitterDM[];
  };

  if (!data.data) return [];

  const sinceTime = since?.getTime() ?? 0;

  return data.data
    .filter((dm) => new Date(dm.created_at).getTime() > sinceTime)
    .map((dm) => ({
      id: randomUUID(),
      source: "x" as const,
      sourceId: dm.id,
      threadId: dm.dm_conversation_id,
      sender: {
        id: dm.sender_id,
        displayName: dm.sender_id, // Would need user lookup for display name
      },
      bodyText: dm.text,
      timestamp: new Date(dm.created_at),
      isRead: false,
      openUrl: "https://x.com/messages",
      raw: dm,
    }));
}

export async function refreshTwitterToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitter token refresh error: ${res.status}`);
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
