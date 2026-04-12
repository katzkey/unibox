import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Discord OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/connect?error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state parameter" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get("discord_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    cookieStore.delete("discord_oauth_state");

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/callback/discord`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", await tokenRes.text());
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 500 }
      );
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };

    // Get Discord user ID
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Discord user info" },
        { status: 500 }
      );
    }

    const user = (await userRes.json()) as { id: string };
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.serviceConnection.upsert({
      where: { userId_service: { userId: user.id, service: "discord" } },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        scopes: JSON.stringify(tokens.scope.split(" ")),
      },
      create: {
        userId: user.id,
        service: "discord",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        scopes: JSON.stringify(tokens.scope.split(" ")),
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/connect?success=discord`
    );
  } catch (error) {
    console.error("Discord OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to complete Discord OAuth" },
      { status: 500 }
    );
  }
}
