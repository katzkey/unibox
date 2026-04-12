import { randomUUID } from "crypto";
import type { UnifiedMessage } from "@/types/message";

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
  };
  content: string;
  timestamp: string;
  attachments: {
    filename: string;
    url: string;
    content_type?: string;
    size: number;
  }[];
}

interface DiscordChannel {
  id: string;
  name?: string;
  guild_id?: string;
  type: number;
}

interface DiscordGuild {
  id: string;
  name: string;
}

export async function fetchDiscordMessages(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  const guilds = await fetchGuilds(accessToken);
  const allMessages: UnifiedMessage[] = [];

  for (const guild of guilds) {
    try {
      const channels = await fetchGuildChannels(accessToken, guild.id);
      // Only text channels (type 0)
      const textChannels = channels.filter((c) => c.type === 0);

      for (const channel of textChannels.slice(0, 5)) {
        try {
          const messages = await fetchChannelMessages(
            accessToken,
            channel.id,
            since
          );

          for (const msg of messages) {
            const avatarUrl = msg.author.avatar
              ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
              : undefined;

            allMessages.push({
              id: randomUUID(),
              source: "discord",
              sourceId: msg.id,
              sender: {
                id: msg.author.id,
                displayName:
                  msg.author.global_name || msg.author.username,
                avatarUrl,
              },
              channel: `${guild.name} / #${channel.name}`,
              bodyText: msg.content,
              timestamp: new Date(msg.timestamp),
              isRead: true,
              openUrl: `https://discord.com/channels/${guild.id}/${channel.id}/${msg.id}`,
              attachments:
                msg.attachments.length > 0
                  ? msg.attachments.map((a) => ({
                      name: a.filename,
                      url: a.url,
                      mimeType: a.content_type,
                      size: a.size,
                    }))
                  : undefined,
              raw: msg,
            });
          }
        } catch (error) {
          console.error(
            `Failed to fetch Discord channel ${channel.name}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch Discord guild ${guild.name}:`,
        error
      );
    }
  }

  return allMessages;
}

async function fetchGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Discord guilds fetch failed:", res.status, errorText);
    throw new Error(`Discord API error: ${res.status}`);
  }

  return (await res.json()) as DiscordGuild[];
}

async function fetchGuildChannels(
  accessToken: string,
  guildId: string
): Promise<DiscordChannel[]> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Discord API error: ${res.status}`);
  }

  return (await res.json()) as DiscordChannel[];
}

async function fetchChannelMessages(
  accessToken: string,
  channelId: string,
  since?: Date
): Promise<DiscordMessage[]> {
  const params = new URLSearchParams({ limit: "20" });
  if (since) {
    // Discord snowflake: (timestamp_ms - DISCORD_EPOCH) << 22
    const DISCORD_EPOCH = BigInt("1420070400000");
    const snowflake = (BigInt(since.getTime()) - DISCORD_EPOCH) << BigInt("22");
    params.set("after", snowflake.toString());
  }

  const res = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Discord API error: ${res.status}`);
  }

  return (await res.json()) as DiscordMessage[];
}

export async function refreshDiscordToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Discord token refresh error: ${res.status}`);
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
