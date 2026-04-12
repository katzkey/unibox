import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

const DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize";
const SCOPES = "identify guilds messages.read";

export async function GET() {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/callback/discord`;

    if (!clientId) {
      return NextResponse.json(
        { error: "DISCORD_CLIENT_ID is not configured" },
        { status: 500 }
      );
    }

    const state = randomBytes(32).toString("hex");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      state,
    });

    const response = NextResponse.redirect(
      `${DISCORD_AUTH_URL}?${params.toString()}`
    );

    response.cookies.set("discord_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Discord OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Discord OAuth" },
      { status: 500 }
    );
  }
}
