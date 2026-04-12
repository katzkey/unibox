import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { fetchGmailMessages, refreshGmailToken } from "@/lib/services/gmail";
import type { UnifiedMessage, ServiceType } from "@/types/message";

export async function fetchAndStoreMessages(
  userId: string,
  service?: ServiceType
): Promise<UnifiedMessage[]> {
  const connections = await prisma.serviceConnection.findMany({
    where: {
      userId,
      ...(service ? { service } : {}),
    },
  });

  const allMessages: UnifiedMessage[] = [];

  for (const conn of connections) {
    try {
      let accessToken = decrypt(conn.accessToken);

      // Refresh token if expired
      if (conn.expiresAt && conn.expiresAt < new Date() && conn.refreshToken) {
        const refreshed = await refreshServiceToken(
          conn.service as ServiceType,
          decrypt(conn.refreshToken)
        );
        accessToken = refreshed.accessToken;

        await prisma.serviceConnection.update({
          where: { id: conn.id },
          data: {
            accessToken: encrypt(refreshed.accessToken),
            expiresAt: refreshed.expiresAt,
          },
        });
      }

      // Get the last fetch time for incremental fetching
      const lastMessage = await prisma.message.findFirst({
        where: { userId, source: conn.service },
        orderBy: { fetchedAt: "desc" },
      });

      const since = lastMessage?.fetchedAt ?? undefined;
      const messages = await fetchServiceMessages(
        conn.service as ServiceType,
        accessToken,
        since
      );

      // Store messages in DB (upsert to avoid duplicates)
      for (const msg of messages) {
        await prisma.message.upsert({
          where: {
            userId_source_sourceId: {
              userId,
              source: msg.source,
              sourceId: msg.sourceId,
            },
          },
          update: {
            data: JSON.stringify(msg),
            isRead: msg.isRead,
          },
          create: {
            userId,
            source: msg.source,
            sourceId: msg.sourceId,
            data: JSON.stringify(msg),
            isRead: msg.isRead,
          },
        });
      }

      allMessages.push(...messages);
    } catch (error) {
      console.error(`Failed to fetch messages for ${conn.service}:`, error);
    }
  }

  // Sort by timestamp descending
  allMessages.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return allMessages;
}

async function fetchServiceMessages(
  service: ServiceType,
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]> {
  switch (service) {
    case "gmail":
      return fetchGmailMessages(accessToken, since);
    default:
      console.error(`Service ${service} is not yet supported`);
      return [];
  }
}

async function refreshServiceToken(
  service: ServiceType,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  switch (service) {
    case "gmail":
      return refreshGmailToken(refreshToken);
    default:
      throw new Error(`Token refresh not supported for ${service}`);
  }
}
