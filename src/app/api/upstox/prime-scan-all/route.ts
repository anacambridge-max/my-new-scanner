/**
 * GET /api/upstox/prime-scan-all
 *
 * Aggregate NSE F&O scanner using the live Upstox NSE instrument master.
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
export const maxDuration = 60;

// Upstox standard APIs allow up to 50 req/sec and 500 req/min.
// Keep concurrency high enough for 210-stock scans, but avoid creating
// hundreds of simultaneous requests that can timeout or be throttled.
const CANDLE_FETCH_CONCURRENCY = 20;
const QUOTE_FALLBACK_CONCURRENCY = 12;

type Quote = {
  last_price: number;
  net_change?: number;
  instrument_token?: string;
  symbol?: string;
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
    prev_close?: number;
  };
  volume?: number;
};

async function withConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<(T | null)[]> {
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

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  );
  return results;
}

function normalizeQuotes(
  requestedKeys: string[],
  response: Record<string, Quote>
): Record<string, Quote> {
  const normalized: Record<string, Quote> = {};
  const entries = Object.entries(response || {});

  for (const requested of requestedKeys) {
    const direct = response?.[requested];
    if (direct) {
      normalized[requested] = direct;
      continue;
    }

    const colonKey = requested.replace("|", ":");
    const byColon = response?.[colonKey];
    if (byColon) {
      normalized[requested] = byColon;
      continue;
    }

    const byToken = entries.find(([, quote]) => quote?.instrument_token === requested);
    if (byToken?.[1]) {
      normalized[requested] = byToken[1];
      continue;
    }

    const requestedSymbol = requested.split("|")[1];
    const bySymbol = entries.find(([, quote]) => quote?.symbol === requestedSymbol);
    if (bySymbol?.[1]) normalized[requested] = bySymbol[1];
  }

  return normalized;
}

async function fetchQuotesResilient(instrumentKeys: string[], accessToken: string): Promise<Record<string, Quote>> {
  if (instrumentKeys.length === 0) return {};

  try {
    const raw = await fetchMarketQuotes(instrumentKeys, accessToken) as Record<string, Quote>;
    const normalized = normalizeQuotes(instrumentKeys, raw);
    if (Object.keys(normalized).length > 0) return normalized;
    console.warn("[prime-scan-all] Batch quote response contained no mappable instruments");
  } catch (error) {
    console.warn(
      "[prime-scan-all] Batch quote request failed; falling back to per-instrument quotes:",
      error instanceof Error ? error.message : String(error)
    );
  }

  const tasks = instrumentKeys.map((key) => async () => {
    const raw = await fetchMarketQuotes([key], accessToken) as Record<string, Quote>;
    const normalized = normalizeQuotes([key], raw);
    return { key, quote: normalized[key] ?? Object.values(raw || {})[0] ?? null };
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
  const universe = await getFnOUniverse();
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
    const allInstrumentKeys = universe.map((i) => i.instrumentKey);
    const quoteResults = await fetchQuotesResilient(allInstrumentKeys, token);

    const prevDateStr = formatDateIST(getPreviousSessionDate());
    const todayDateStr = formatDateIST(new Date());
    const symbolsWithQuotes = universe.filter(
      (i) => Number(quoteResults[i.instrumentKey]?.last_price) > 0
    );

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

    const candleTasks = symbolsWithQuotes.map((instrument) => async (): Promise<CandleResult> => {
      // After market close, do NOT call Intraday + fallback for every stock.
      // That can become 3 candle requests/stock (630 calls for 210 stocks)
      // and cause throttling/timeouts. Historical V3 contains the completed
      // day's 5-minute candles and is the correct source after close.
      const sessionPromise = market.status === "CLOSED"
        ? fetchHistoricalCandles(instrument.instrumentKey, token, todayDateStr, todayDateStr)
        : fetchIntradayCandles(instrument.instrumentKey, token);

      const [sessionRaw, histRaw] = await Promise.all([
        sessionPromise.catch(() => []),
        fetchHistoricalCandles(instrument.instrumentKey, token, prevDateStr, prevDateStr).catch(() => []),
      ]);

      return {
        symbol: instrument.symbol,
        intraday: [...(sessionRaw as unknown as (string | number)[][])].reverse().map(toCandle),
        prev: [...(histRaw as unknown as (string | number)[][])].reverse().map(toCandle),
      };
    });

    const candleResults = await withConcurrency(candleTasks, CANDLE_FETCH_CONCURRENCY);
    const candleMap = new Map<string, CandleResult>();
    candleResults.forEach((r) => {
      if (r) candleMap.set(r.symbol, r);
    });

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
      const prevHigh = prevCandles.length ? Math.max(...prevCandles.map((c) => c.high)) : null;
      const prevLow = prevCandles.length ? Math.min(...prevCandles.map((c) => c.low)) : null;

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
      ...(symbolsWithQuotes.length === 0 ? { error: "UPSTOX_RETURNED_NO_QUOTES_FOR_UNIVERSE" } : {}),
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
