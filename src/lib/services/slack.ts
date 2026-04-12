import { randomUUID } from "crypto";
import type { UnifiedMessage } from "@/types/message";

const SLACK_API = "https://slack.com/api";

interface SlackMessage {
  type: string;
  ts: string;
  user: string;
  text: string;
  team: string;
  files?: {
    name: string;
    url_private: string;
    mimetype: string;
    size: number;
  }[];
}

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackUser {
  id: string;
  real_name: string;
  profile: {
    display_name: string;
    image_48?: string;
  };
}

export async function fetchSlackMessages(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  // Get list of channels the user is in
  const channels = await fetchChannels(accessToken);
  const allMessages: UnifiedMessage[] = [];

  // Cache users to avoid redundant API calls
  const userCache = new Map<string, SlackUser>();

  for (const channel of channels) {
    try {
      const messages = await fetchChannelMessages(
        accessToken,
        channel.id,
        since
      );

      for (const msg of messages) {
        if (msg.type !== "message" || !msg.user) continue;

        let user = userCache.get(msg.user);
        if (!user) {
          user = await fetchUser(accessToken, msg.user);
          userCache.set(msg.user, user);
        }

        const team = msg.team ?? "";
        allMessages.push({
          id: randomUUID(),
          source: "slack",
          sourceId: `${channel.id}-${msg.ts}`,
          sender: {
            id: msg.user,
            displayName:
              user.profile.display_name || user.real_name || msg.user,
            avatarUrl: user.profile.image_48,
          },
          channel: `#${channel.name}`,
          bodyText: msg.text,
          timestamp: new Date(parseFloat(msg.ts) * 1000),
          isRead: true, // Slack doesn't have per-message read status
          openUrl: `https://app.slack.com/client/${team}/${channel.id}/p${msg.ts.replace(".", "")}`,
          attachments: msg.files?.map((f) => ({
            name: f.name,
            url: f.url_private,
            mimeType: f.mimetype,
            size: f.size,
          })),
          raw: msg,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch Slack channel ${channel.name}:`, error);
    }
  }

  return allMessages;
}

async function fetchChannels(accessToken: string): Promise<SlackChannel[]> {
  const res = await fetch(
    `${SLACK_API}/users.conversations?types=public_channel,private_channel&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Slack API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    ok: boolean;
    channels: SlackChannel[];
    error?: string;
  };

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.channels;
}

async function fetchChannelMessages(
  accessToken: string,
  channelId: string,
  since?: Date
): Promise<SlackMessage[]> {
  const params = new URLSearchParams({
    channel: channelId,
    limit: "20",
  });

  if (since) {
    params.set("oldest", String(since.getTime() / 1000));
  }

  const res = await fetch(
    `${SLACK_API}/conversations.history?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Slack API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    ok: boolean;
    messages: SlackMessage[];
    error?: string;
  };

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.messages;
}

async function fetchUser(
  accessToken: string,
  userId: string
): Promise<SlackUser> {
  const res = await fetch(`${SLACK_API}/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Slack API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    ok: boolean;
    user: SlackUser;
    error?: string;
  };

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.user;
}

export async function refreshSlackToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Slack token refresh error: ${res.status}`);
  }

  const data = (await res.json()) as {
    ok: boolean;
    access_token: string;
    expires_in: number;
    error?: string;
  };

  if (!data.ok) {
    throw new Error(`Slack token refresh error: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
