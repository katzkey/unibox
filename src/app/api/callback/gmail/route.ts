import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  USER_ID_COOKIE,
  generateAppUserId,
  getUserIdFromRequest,
} from "@/lib/get-user-id";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Gmail OAuth error:", error);
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

    // Verify state (CSRF protection)
    const cookieStore = await cookies();
    const savedState = cookieStore.get("gmail_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    // Clear the state cookie
    cookieStore.delete("gmail_oauth_state");

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/callback/gmail`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Gmail token exchange failed:", errorData);
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 500 }
      );
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    // Get user info to identify the user
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error("Failed to fetch Google user info");
      return NextResponse.json(
        { error: "Failed to fetch user info" },
        { status: 500 }
      );
    }

    const userInfo = (await userInfoResponse.json()) as { id: string };
    // Use app-level userId (from cookie) to unify connections across services.
    // Fall back to generating a new one if the cookie is missing.
    const userId = getUserIdFromRequest(request) ?? generateAppUserId();

    // Encrypt tokens and save to DB
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.serviceConnection.upsert({
      where: {
        userId_service: { userId, service: "gmail" },
      },
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
        service: "gmail",
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : undefined,
        expiresAt,
        scopes: JSON.stringify(tokens.scope.split(" ")),
      },
    });

    const redirectResponse = NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/connect?success=gmail`
    );

    // Store userId in cookie for frontend API calls (temporary until proper auth)
    redirectResponse.cookies.set(USER_ID_COOKIE, userId, {
      httpOnly: false, // Frontend needs to read this
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return redirectResponse;
  } catch (error) {
    console.error("Gmail OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to complete Gmail OAuth" },
      { status: 500 }
    );
  }
}
