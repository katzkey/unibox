import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  USER_ID_COOKIE,
  generateAppUserId,
  getUserIdFromRequest,
} from "@/lib/get-user-id";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Slack OAuth error:", error);
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
    const savedState = cookieStore.get("slack_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    cookieStore.delete("slack_oauth_state");

    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/callback/slack`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Slack token exchange failed:", await tokenRes.text());
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 500 }
      );
    }

    const tokens = (await tokenRes.json()) as {
      ok: boolean;
      authed_user: {
        id: string;
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope: string;
      };
      error?: string;
    };

    if (!tokens.ok) {
      console.error("Slack token error:", tokens.error);
      return NextResponse.json(
        { error: `Slack error: ${tokens.error}` },
        { status: 500 }
      );
    }

    // Use app-level userId (from cookie) to unify connections across services.
    const userId = getUserIdFromRequest(request) ?? generateAppUserId();
    const userAccessToken = tokens.authed_user.access_token;
    const userRefreshToken = tokens.authed_user.refresh_token;
    const userScope = tokens.authed_user.scope;
    const expiresAt = tokens.authed_user.expires_in
      ? new Date(Date.now() + tokens.authed_user.expires_in * 1000)
      : null;

    await prisma.serviceConnection.upsert({
      where: { userId_service: { userId, service: "slack" } },
      update: {
        accessToken: encrypt(userAccessToken),
        refreshToken: userRefreshToken ? encrypt(userRefreshToken) : undefined,
        expiresAt,
        scopes: JSON.stringify(userScope.split(",")),
      },
      create: {
        userId,
        service: "slack",
        accessToken: encrypt(userAccessToken),
        refreshToken: userRefreshToken ? encrypt(userRefreshToken) : undefined,
        expiresAt,
        scopes: JSON.stringify(userScope.split(",")),
      },
    });

    const redirectResponse = NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/connect?success=slack`
    );

    redirectResponse.cookies.set(USER_ID_COOKIE, userId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return redirectResponse;
  } catch (error) {
    console.error("Slack OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to complete Slack OAuth" },
      { status: 500 }
    );
  }
}
