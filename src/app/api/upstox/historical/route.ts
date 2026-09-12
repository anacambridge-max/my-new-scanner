/**
 * GET /api/upstox/historical?symbol=RELIANCE&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Fetches historical 5-minute candles for a single F&O stock.
 * Uses server-side token. Returns candle data without exposing credentials.
 */

import { NextRequest } from "next/server";
import { getValidToken } from "@/lib/upstox/token";
import { fetchHistoricalCandles, fetchIntradayCandles } from "@/lib/upstox/api";
import { getFnOBySymbol } from "@/lib/upstox/universe";
import type { RawCandle } from "@/engine/prime/candle";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const intraday = searchParams.get("intraday") === "1";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  if (!symbol) {
    return Response.json({ error: "symbol is required" }, { status: 400 });
  }

  const instrument = await getFnOBySymbol(symbol);
  if (!instrument) {
    return Response.json({ error: `Unknown F&O symbol: ${symbol}` }, { status: 404 });
  }

  const token = await getValidToken();
  if (!token) {
    return Response.json(
      { error: "UPSTOX_DISCONNECTED", message: "Connect Upstox to fetch market data." },
      { status: 401 }
    );
  }

  try {
    let rawCandles: (string | number)[][];

    if (intraday) {
      rawCandles = (await fetchIntradayCandles(instrument.instrumentKey, token)) as unknown as (string | number)[][];
    } else {
      rawCandles = (await fetchHistoricalCandles(instrument.instrumentKey, token, from, to)) as unknown as (string | number)[][];
    }

    const candles: RawCandle[] = [...rawCandles]
      .reverse()
      .map((c) => ({
        timestamp: String(c[0]),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5]),
      }));

    return Response.json({
      symbol,
      instrumentKey: instrument.instrumentKey,
      candleCount: candles.length,
      timeframe: "5minute",
      candles,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Historical] ${symbol}:`, message);
    return Response.json(
      { error: "Failed to fetch historical data", detail: message },
      { status: 500 }
    );
  }
}
