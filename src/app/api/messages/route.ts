import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ServiceType, UnifiedMessage } from "@/types/message";

const VALID_SERVICES: ServiceType[] = [
  "gmail",
  "slack",
  "discord",
  "x",
  "instagram",
  "line",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const service = searchParams.get("service");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const cursor = searchParams.get("cursor"); // fetchedAt cursor for pagination

    // TODO: Replace with actual auth session userId
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Validate service filter
    if (service && !VALID_SERVICES.includes(service as ServiceType)) {
      return NextResponse.json(
        { error: `Invalid service: ${service}` },
        { status: 400 }
      );
    }

    // Fetch without pagination yet; we sort in memory by the embedded message
    // timestamp (not fetchedAt) so that services interleave chronologically.
    const rows = await prisma.message.findMany({
      where: {
        userId,
        ...(service ? { source: service } : {}),
      },
      orderBy: { fetchedAt: "desc" },
    });

    const allUnified: UnifiedMessage[] = rows.map((msg) => {
      const data = JSON.parse(msg.data) as UnifiedMessage;
      return {
        ...data,
        id: msg.id,
        isRead: msg.isRead,
        timestamp: new Date(data.timestamp),
      };
    });

    // Sort by real message timestamp, newest first, so Gmail/Slack interleave.
    allUnified.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply cursor (ISO timestamp of last seen message) and limit.
    const cursorTime = cursor ? new Date(cursor).getTime() : null;
    const filtered = cursorTime
      ? allUnified.filter((m) => new Date(m.timestamp).getTime() < cursorTime)
      : allUnified;
    const unified = filtered.slice(0, Math.min(limit, 100));

    const nextCursor =
      unified.length === limit
        ? new Date(unified[unified.length - 1].timestamp).toISOString()
        : null;

    return NextResponse.json({ messages: unified, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
