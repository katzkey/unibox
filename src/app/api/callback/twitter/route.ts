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
      console.error("Twitter OAuth error:", error);
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
    const savedState = cookieStore.get("twitter_oauth_state")?.value;
    const codeVerifier = cookieStore.get("twitter_code_verifier")?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    if (!codeVerifier) {
      return NextResponse.json(
        { error: "Missing PKCE code verifier" },
        { status: 400 }
      );
    }

    cookieStore.delete("twitter_oauth_state");
    cookieStore.delete("twitter_code_verifier");

    // Exchange code for tokens using PKCE
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/callback/twitter`,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Twitter token exchange failed:", await tokenRes.text());
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 500 }
      );
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    // Get Twitter user ID
    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Twitter user info" },
        { status: 500 }
      );
    }

    const userData = (await userRes.json()) as { data: { id: string } };
    const userId = userData.data.id;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.serviceConnection.upsert({
      where: { userId_service: { userId, service: "x" } },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : undefined,
        expiresAt,
        scopes: JSON.stringify(tokens.scope.split(" ")),
      },
      create: {
        userId,
        service: "x",
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : undefined,
        expiresAt,
        scopes: JSON.stringify(tokens.scope.split(" ")),
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/connect?success=x`
    );
  } catch (error) {
    console.error("Twitter OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to complete Twitter OAuth" },
      { status: 500 }
    );
  }
}
