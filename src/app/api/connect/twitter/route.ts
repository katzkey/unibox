import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

const TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const SCOPES = "tweet.read users.read dm.read offline.access";

export async function GET() {
  try {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/callback/twitter`;

    if (!clientId) {
      return NextResponse.json(
        { error: "TWITTER_CLIENT_ID is not configured" },
        { status: 500 }
      );
    }

    const state = randomBytes(32).toString("hex");

    // PKCE: generate code_verifier and code_challenge
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const response = NextResponse.redirect(
      `${TWITTER_AUTH_URL}?${params.toString()}`
    );

    response.cookies.set("twitter_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    response.cookies.set("twitter_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Twitter OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Twitter OAuth" },
      { status: 500 }
    );
  }
}
