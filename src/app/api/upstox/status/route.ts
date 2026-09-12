/**
 * GET /api/upstox/status
 *
 * Returns Upstox connection status and safe token info.
 * NEVER returns the actual access token.
 */

import { getSafeTokenInfo } from "@/lib/upstox/token";
import { getMarketStatus } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tokenInfo = await getSafeTokenInfo();
    const marketStatus = getMarketStatus();

    return Response.json({
      upstox: {
        connected: tokenInfo.connected,
        expired: tokenInfo.expired,
        expiresAt: tokenInfo.expiresAt,
        refreshedAt: tokenInfo.refreshedAt,
        // NEVER return the actual token
      },
      market: marketStatus,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: "Status check failed", detail: String(err) },
      { status: 500 }
    );
  }
}
