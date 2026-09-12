/**
 * GET /api/upstox/fno-universe
 *
 * Returns the NSE F&O eligible instrument universe.
 * Safe to return to client — no credentials exposed.
 */

import { getFnOUniverse } from "@/lib/upstox/universe";
import { getMarketStatus } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const universe = getFnOUniverse();
    const market = getMarketStatus();

    return Response.json({
      count: universe.length,
      market,
      instruments: universe.map((i) => ({
        symbol: i.symbol,
        name: i.name,
        lotSize: i.lotSize,
        series: i.series,
        // DO NOT expose isin/instrumentKey/futuresKey — client doesn't need raw keys
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to load F&O universe", detail: String(err) },
      { status: 500 }
    );
  }
}
