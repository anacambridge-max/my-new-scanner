/**
 * GET /api/upstox/prime-scan-all
 *
 * Aggregate NSE F&O scanner.
 *
 * Architecture:
 * 1. Load authenticated Upstox token (server-side only)
 * 2. Load NSE F&O universe
 * 3. Batch-fetch market quotes (with per-instrument fallback)
 * 4. For quoted symbols, fetch 5-min candle data
 * 5. Build YH/YL from previous session data
 * 6. Run Prime scanner engine on each symbol
 * 7. Rank and return normalized rows
 *
 * SECURITY: Access token never returned to client.
 */

import { getValidToken } from "@/lib/upstox/token";
import { getFnOUniverse } from "@/lib/upstox/universe";
import {
  fetchMarketQuotes,
  fetchIntradayCandles,
  fetchHistoricalCandles,
} from "@/lib/upstox/api";
import { scanInstrument, rankScanResults } from "@/engine/prime/scanner";
import { getMarketStatus, formatDateIST, getPreviousSessionDate } from "@/lib/market";
import type { PrimeScanResponse } from "@/domain/prime";
import type { RawCandle } from "@/engine/prime/candle";

export const dynamic = "force-dynamic";

const CANDLE_FETCH_CONCURRENCY = 5;
const QUOTE_FALLBACK_CONCURRENCY = 5;
const MAX_CANDLE_SYMBOLS = 50;

type Quote = {
  last_price: number;
  net_change?: number;
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
    prev_close?: number;
  };
};

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const current = idx++;
      try {
        results[current] = await tasks[current]();
      } catch {
        results[current] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Upstox rejects a complete batch when even one instrument key is invalid.
 * The static F&O list can contain stale/changed ISINs, so a single bad key
 * must not make all 50 symbols appear as "INSUFFICIENT DATA".
 */
async function fetchQuotesResilient(
  instrumentKeys: string[],
  accessToken: string
): Promise<Record<string, Quote>> {
  if (instrumentKeys.length === 0) return {};

  try {
    return await fetchMarketQuotes(instrumentKeys, accessToken) as Record<string, Quote>;
  } catch (batchError) {
    console.warn(
      "[prime-scan-all] Batch quote request failed; falling back to per-instrument quotes:",
      batchError instanceof Error ? batchError.message : String(batchError)
    );
  }

  const tasks = instrumentKeys.map((key) => async () => {
    const result = await fetchMarketQuotes([key], accessToken) as Record<string, Quote>;
    return { key, quote: result[key] ?? Object.values(result)[0] ?? null };
  });

  const results = await withConcurrency(tasks, QUOTE_FALLBACK_CONCURRENCY);
  const quotes: Record<string, Quote> = {};

  for (const result of results) {
    if (result?.quote) quotes[result.key] = result.quote;
  }

  return quotes;
}

export async function GET() {
  const token = await getValidToken();
  const market = getMarketStatus();
  const universe = getFnOUniverse();
  const generatedAt = new Date().toISOString();

  if (!token) {
    const response: PrimeScanResponse = {
      universeCount: universe.length,
      scanCount: 0,
      generatedAt,
      marketStatus: market.status,
      upstoxConnected: false,
      rows: [],
      error: "UPSTOX_DISCONNECTED_OR_EXPIRED",
    };
    return Response.json(response, { status: 401 });
  }

  try {
    // ── Step 1: Batch-fetch market quotes with safe fallback ─────────────────
    const allInstrumentKeys = universe.map((i) => i.instrumentKey);
    const quoteResults = await fetchQuotesResilient(allInstrumentKeys, token);

    // ── Step 2: Determine previous session date ──────────────────────────────
    const prevDate = getPreviousSessionDate();
    const prevDateStr = formatDateIST(prevDate);

    // ── Step 3: Select symbols that actually returned market data ────────────
    const symbolsWithQuotes = universe.filter(
      (i) => quoteResults[i.instrumentKey]?.last_price > 0
    );
    const symbolsForCandles = symbolsWithQuotes.slice(0, MAX_CANDLE_SYMBOLS);

    type CandleResult = {
      symbol: string;
      intraday: RawCandle[];
      prev: RawCandle[];
    };

    const toCandle = (c: (string | number)[]): RawCandle => ({
      timestamp: String(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    });

    const candleTasks = symbolsForCandles.map((instrument) => async (): Promise<CandleResult> => {
      const [intradayRaw, histRaw] = await Promise.all([
        fetchIntradayCandles(instrument.instrumentKey, token).catch(() => []),
        fetchHistoricalCandles(instrument.instrumentKey, token, prevDateStr, prevDateStr).catch(() => []),
      ]);

      const intradayCandles = [...(intradayRaw as unknown as (string | number)[][])]
        .reverse()
        .map(toCandle);
      const prevCandles = [...(histRaw as unknown as (string | number)[][])]
        .reverse()
        .map(toCandle);

      return {
        symbol: instrument.symbol,
        intraday: intradayCandles,
        prev: prevCandles,
      };
    });

    const candleResults = await withConcurrency(candleTasks, CANDLE_FETCH_CONCURRENCY);
    const candleMap = new Map<string, CandleResult>();
    candleResults.forEach((r) => {
      if (r) candleMap.set(r.symbol, r);
    });

    // ── Step 4: Run Prime scanner on each symbol ─────────────────────────────
    const rows = universe.map((instrument) => {
      const quote = quoteResults[instrument.instrumentKey];
      const candleData = candleMap.get(instrument.symbol);

      const ltp = quote?.last_price ?? null;
      const prevClose =
        quote?.ohlc?.prev_close ??
        candleData?.prev?.[candleData.prev.length - 1]?.close ??
        quote?.ohlc?.close ??
        null;

      const dayChangePct =
        ltp !== null && prevClose !== null && prevClose > 0
          ? ((ltp - prevClose) / prevClose) * 100
          : null;

      const prevCandles = candleData?.prev ?? [];
      const prevHigh = prevCandles.length > 0 ? Math.max(...prevCandles.map((c) => c.high)) : null;
      const prevLow = prevCandles.length > 0 ? Math.min(...prevCandles.map((c) => c.low)) : null;

      return scanInstrument({
        symbol: instrument.symbol,
        name: instrument.name,
        instrumentKey: instrument.instrumentKey,
        futuresInstrumentKey: instrument.futuresKey,
        lotSize: instrument.lotSize,
        isin: instrument.isin,
        ltp,
        dayChangePct: dayChangePct !== null ? parseFloat(dayChangePct.toFixed(2)) : null,
        open: quote?.ohlc?.open ?? null,
        prevClose,
        prevHigh,
        prevLow,
        candles5m: candleData?.intraday ?? [],
      });
    });

    const ranked = rankScanResults(rows);

    const response: PrimeScanResponse = {
      universeCount: universe.length,
      scanCount: ranked.length,
      generatedAt,
      marketStatus: market.status,
      upstoxConnected: true,
      rows: ranked,
      ...(symbolsWithQuotes.length === 0
        ? { error: "UPSTOX_RETURNED_NO_QUOTES_FOR_UNIVERSE" }
        : {}),
    };

    return Response.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[prime-scan-all] Error:", message);

    const response: PrimeScanResponse = {
      universeCount: universe.length,
      scanCount: 0,
      generatedAt,
      marketStatus: market.status,
      upstoxConnected: true,
      rows: [],
      error: message,
    };
    return Response.json(response, { status: 500 });
  }
}
