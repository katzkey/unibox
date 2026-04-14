import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  USER_ID_COOKIE,
  generateAppUserId,
  getUserIdFromRequest,
} from "@/lib/get-user-id";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/callback/gmail`;

    if (!clientId) {
      return NextResponse.json(
        { error: "GOOGLE_CLIENT_ID is not configured" },
        { status: 500 }
      );
    }

    const state = randomBytes(32).toString("hex");
    const appUserId = getUserIdFromRequest(request) ?? generateAppUserId();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const response = NextResponse.redirect(
      `${GOOGLE_AUTH_URL}?${params.toString()}`
    );

    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    response.cookies.set(USER_ID_COOKIE, appUserId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Gmail OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Gmail OAuth" },
      { status: 500 }
    );
  }
}
