import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

const SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize";
const SCOPES = [
  "channels:history",
  "channels:read",
  "groups:history",
  "groups:read",
  "users:read",
].join(",");

export async function GET() {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/callback/slack`;

    if (!clientId) {
      return NextResponse.json(
        { error: "SLACK_CLIENT_ID is not configured" },
        { status: 500 }
      );
    }

    const state = randomBytes(32).toString("hex");

    const cookieStore = await cookies();
    cookieStore.set("slack_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
    });

    return NextResponse.redirect(`${SLACK_AUTH_URL}?${params.toString()}`);
  } catch (error) {
    console.error("Slack OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Slack OAuth" },
      { status: 500 }
    );
  }
}
