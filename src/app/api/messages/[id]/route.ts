import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { isRead?: boolean };

    if (typeof body.isRead !== "boolean") {
      return NextResponse.json(
        { error: "isRead (boolean) is required" },
        { status: 400 }
      );
    }

    const message = await prisma.message.update({
      where: { id },
      data: { isRead: body.isRead },
    });

    return NextResponse.json({ id: message.id, isRead: message.isRead }, { status: 200 });
  } catch (error) {
    console.error("Failed to update message:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}
