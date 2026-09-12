/**
 * GET /api/upstox/callback
 *
 * OAuth 2.0 callback handler.
 * Exchanges authorization code for access token.
 * Saves token server-side. NEVER exposes token to client.
 */

import { NextRequest } from "next/server";
import { exchangeCodeForToken } from "@/lib/upstox/api";
import { saveToken } from "@/lib/upstox/token";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    const msg = errorDesc || error;
    return Response.redirect(
      new URL(`/?upstox_error=${encodeURIComponent(msg)}`, req.url)
    );
  }

  if (!code) {
    return Response.redirect(
      new URL("/?upstox_error=no_code", req.url)
    );
  }

  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return Response.redirect(
      new URL("/?upstox_error=missing_env", req.url)
    );
  }

  try {
    const tokenResponse = await exchangeCodeForToken(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Calculate expiry — Upstox tokens expire at ~next market open (typically ~24h)
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : null;

    await saveToken({
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type || "Bearer",
      expiresAt,
      refreshedAt: new Date().toISOString(),
    });

    return Response.redirect(new URL("/?upstox_connected=1", req.url));
  } catch (err) {
    console.error("[Upstox Callback] Token exchange failed:", err);
    return Response.redirect(
      new URL("/?upstox_error=token_exchange_failed", req.url)
    );
  }
}
