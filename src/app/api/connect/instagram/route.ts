import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

const IG_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const SCOPES = "instagram_business_basic,instagram_business_manage_messages";

export async function GET() {
  try {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/callback/instagram`;

    if (!clientId) {
      return NextResponse.json(
        { error: "INSTAGRAM_CLIENT_ID is not configured" },
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
      `${IG_AUTH_URL}?${params.toString()}`
    );

    response.cookies.set("instagram_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Instagram OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Instagram OAuth" },
      { status: 500 }
    );
  }
}
