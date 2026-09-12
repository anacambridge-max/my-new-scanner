/**
 * GET /api/upstox/login
 *
 * Redirects to Upstox OAuth authorization page.
 * Client credentials are read from server-side env vars ONLY.
 */

import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = process.env.UPSTOX_CLIENT_ID;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return Response.json(
      {
        error: "UPSTOX_CLIENT_ID and UPSTOX_REDIRECT_URI must be set in environment variables.",
        configured: {
          clientId: !!clientId,
          redirectUri: !!redirectUri,
        },
      },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });

  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;

  return Response.redirect(authUrl);
}
