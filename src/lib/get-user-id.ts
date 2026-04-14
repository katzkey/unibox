/**
 * Get the userId from cookie.
 * Temporary implementation until proper auth (NextAuth) is set up.
 */
import { randomUUID } from "crypto";

const COOKIE_NAME = "unibox_user_id";

export const USER_ID_COOKIE = COOKIE_NAME;

/** Generate a new app-level userId (UUID). */
export function generateAppUserId(): string {
  return randomUUID();
}

/** Client-side: read userId from document.cookie */
export function getUserIdFromClient(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Server-side: read userId from request cookies */
export function getUserIdFromRequest(
  request: Request
): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
