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
      console.error("Instagram OAuth error:", error);
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
    const savedState = cookieStore.get("instagram_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    cookieStore.delete("instagram_oauth_state");

    // Exchange code for short-lived token
    const tokenRes = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.INSTAGRAM_CLIENT_ID!,
          client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/callback/instagram`,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenRes.ok) {
      console.error("Instagram token exchange failed:", await tokenRes.text());
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 500 }
      );
    }

    const shortLived = (await tokenRes.json()) as {
      access_token: string;
      user_id: number;
    };

    // Exchange for long-lived token
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&access_token=${shortLived.access_token}`
    );

    if (!longLivedRes.ok) {
      console.error("Instagram long-lived token failed:", await longLivedRes.text());
      return NextResponse.json(
        { error: "Failed to get long-lived token" },
        { status: 500 }
      );
    }

    const longLived = (await longLivedRes.json()) as {
      access_token: string;
      expires_in: number;
    };

    const userId = String(shortLived.user_id);
    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);

    await prisma.serviceConnection.upsert({
      where: { userId_service: { userId, service: "instagram" } },
      update: {
        accessToken: encrypt(longLived.access_token),
        refreshToken: encrypt(longLived.access_token), // Long-lived token is used for refresh
        expiresAt,
        scopes: JSON.stringify(SCOPES.split(",")),
      },
      create: {
        userId,
        service: "instagram",
        accessToken: encrypt(longLived.access_token),
        refreshToken: encrypt(longLived.access_token),
        expiresAt,
        scopes: JSON.stringify(SCOPES.split(",")),
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/connect?success=instagram`
    );
  } catch (error) {
    console.error("Instagram OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to complete Instagram OAuth" },
      { status: 500 }
    );
  }
}

const SCOPES = "instagram_business_basic,instagram_business_manage_messages";
