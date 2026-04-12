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

    const messages = await prisma.message.findMany({
      where: {
        userId,
        ...(service ? { source: service } : {}),
        ...(cursor ? { fetchedAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { fetchedAt: "desc" },
      take: Math.min(limit, 100),
    });

    const unified: UnifiedMessage[] = messages.map((msg) => {
      const data = JSON.parse(msg.data) as UnifiedMessage;
      return {
        ...data,
        id: msg.id,
        isRead: msg.isRead,
        timestamp: new Date(data.timestamp),
      };
    });

    const nextCursor =
      messages.length === limit
        ? messages[messages.length - 1].fetchedAt.toISOString()
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
