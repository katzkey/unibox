import { NextRequest, NextResponse } from "next/server";
import { fetchAndStoreMessages } from "@/lib/fetch-messages";
import type { ServiceType } from "@/types/message";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId: string;
      service?: ServiceType;
    };

    if (!body.userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const messages = await fetchAndStoreMessages(body.userId, body.service);

    return NextResponse.json(
      { count: messages.length, messages },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
