/**
 * GET /api/upstox/prime-scan?symbol=RELIANCE
 *
 * Single-symbol Prime scan using historical candles.
 * Useful for the detail panel.
 */

import { NextRequest } from "next/server";
import { getValidToken } from "@/lib/upstox/token";
import { fetchHistoricalCandles, fetchIntradayCandles, fetchMarketQuotes } from "@/lib/upstox/api";
import { getFnOBySymbol } from "@/lib/upstox/universe";
import { scanInstrument } from "@/engine/prime/scanner";
import { getMarketStatus, formatDateIST, getPreviousSessionDate } from "@/lib/market";
import type { RawCandle } from "@/engine/prime/candle";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

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
      { error: "UPSTOX_DISCONNECTED" },
      { status: 401 }
    );
  }

  const market = getMarketStatus();
  const prevDate = getPreviousSessionDate();
  const prevDateStr = formatDateIST(prevDate);

  try {
    const intradayRaw = await fetchIntradayCandles(instrument.instrumentKey, token);

    const histRaw = await fetchHistoricalCandles(
      instrument.instrumentKey,
      token,
      prevDateStr,
      prevDateStr
    );

    const toCandle = (c: (string | number)[]): RawCandle => ({
      timestamp: String(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    });

    const intradayCandles: RawCandle[] = [...(intradayRaw as unknown as (string | number)[][])].reverse().map(toCandle);
    const prevCandles: RawCandle[] = [...(histRaw as unknown as (string | number)[][])].reverse().map(toCandle);

    const prevHigh = prevCandles.length > 0 ? Math.max(...prevCandles.map(c => c.high)) : null;
    const prevLow = prevCandles.length > 0 ? Math.min(...prevCandles.map(c => c.low)) : null;

    const quotes = await fetchMarketQuotes([instrument.instrumentKey], token);
    const quote = quotes[instrument.instrumentKey];

    const ltp = quote?.last_price ?? (intradayCandles.length > 0 ? intradayCandles[intradayCandles.length - 1].close : null);
    const prevClose = quote?.ohlc?.prev_close ?? prevCandles[prevCandles.length - 1]?.close ?? null;
    const dayChangePct = ltp !== null && prevClose !== null && prevClose > 0
      ? parseFloat(((ltp - prevClose) / prevClose * 100).toFixed(2))
      : null;

    const result = scanInstrument({
      symbol: instrument.symbol,
      name: instrument.name,
      instrumentKey: instrument.instrumentKey,
      futuresInstrumentKey: instrument.futuresKey,
      lotSize: instrument.lotSize,
      isin: instrument.isin,
      ltp,
      dayChangePct,
      open: quote?.ohlc?.open ?? null,
      prevClose,
      prevHigh,
      prevLow,
      candles5m: intradayCandles,
    });

    return Response.json({
      market,
      generatedAt: new Date().toISOString(),
      row: { ...result, rank: 1 },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[prime-scan] ${symbol}:`, message);
    return Response.json(
      { error: "Scan failed", detail: message },
      { status: 500 }
    );
  }
}
