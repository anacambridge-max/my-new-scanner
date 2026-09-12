/* GET /api/upstox/prime-scan-all */

import { getValidToken } from "@/lib/upstox/token";
import { getFnOUniverse } from "@/lib/upstox/universe";
import { fetchMarketQuotes, fetchIntradayCandles, fetchHistoricalCandles, fetchDailyOHLC } from "@/lib/upstox/api";
import { scanInstrument, rankScanResults } from "@/engine/prime/scanner";
import { getMarketStatus, formatDateIST, getPreviousSessionDate, nowIST } from "@/lib/market";
import type { PrimeScanResponse } from "@/domain/prime";
import type { RawCandle } from "@/engine/prime/candle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keep request starts below Upstox's 50 req/sec standard-API ceiling while
// allowing a 210-stock scan to finish within the serverless time budget.
const CANDLE_FETCH_CONCURRENCY = 40;
const QUOTE_FALLBACK_CONCURRENCY = 12;

type Quote = {
  last_price: number;
  net_change?: number;
  instrument_token?: string;
  symbol?: string;
  prev_close_price?: number;
  year_high?: number;
  year_low?: number;
  ohlc?: { open: number; high: number; low: number; close: number; prev_close?: number };
  volume?: number;
};

type DailyOHLC = {
  last_price?: number;
  instrument_token?: string;
  prev_ohlc?: { open: number; high: number; low: number; close: number; volume: number; ts: number };
  live_ohlc?: { open: number; high: number; low: number; close: number; volume: number; ts: number };
};

async function withConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const current = idx++;
      try { results[current] = await tasks[current](); } catch { results[current] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

function normalizeByInstrumentKey<T extends { instrument_token?: string; symbol?: string }>(requestedKeys: string[], response: Record<string, T>): Record<string, T> {
  const normalized: Record<string, T> = {};
  const entries = Object.entries(response || {});
  for (const requested of requestedKeys) {
    const direct = response?.[requested];
    if (direct) { normalized[requested] = direct; continue; }
    const colon = response?.[requested.replace("|", ":")];
    if (colon) { normalized[requested] = colon; continue; }
    const byToken = entries.find(([, value]) => value?.instrument_token === requested);
    if (byToken?.[1]) { normalized[requested] = byToken[1]; continue; }
    const symbol = requested.split("|")[1];
    const bySymbol = entries.find(([, value]) => value?.symbol === symbol);
    if (bySymbol?.[1]) normalized[requested] = bySymbol[1];
  }
  return normalized;
}

async function fetchQuotesResilient(instrumentKeys: string[], accessToken: string): Promise<Record<string, Quote>> {
  try {
    const raw = await fetchMarketQuotes(instrumentKeys, accessToken) as Record<string, Quote>;
    const normalized = normalizeByInstrumentKey(instrumentKeys, raw);
    if (Object.keys(normalized).length) return normalized;
  } catch (error) {
    console.warn("[prime-scan-all] Batch V3 quotes failed:", error instanceof Error ? error.message : String(error));
  }

  const tasks = instrumentKeys.map((key) => async () => {
    const raw = await fetchMarketQuotes([key], accessToken) as Record<string, Quote>;
    const normalized = normalizeByInstrumentKey([key], raw);
    return { key, quote: normalized[key] ?? Object.values(raw || {})[0] ?? null };
  });
  const results = await withConcurrency(tasks, QUOTE_FALLBACK_CONCURRENCY);
  const quotes: Record<string, Quote> = {};
  for (const result of results) if (result?.quote) quotes[result.key] = result.quote;
  return quotes;
}

export async function GET() {
  const token = await getValidToken();
  const market = getMarketStatus();
  const universe = await getFnOUniverse();
  const generatedAt = new Date().toISOString();

  if (!token) {
    return Response.json({ universeCount: universe.length, scanCount: 0, generatedAt, marketStatus: market.status, upstoxConnected: false, rows: [], error: "UPSTOX_DISCONNECTED_OR_EXPIRED" } satisfies PrimeScanResponse, { status: 401 });
  }

  try {
    const allKeys = universe.map((i) => i.instrumentKey);
    const quoteResults = await fetchQuotesResilient(allKeys, token);

    let dailyResults: Record<string, DailyOHLC> = {};
    try {
      const raw = await fetchDailyOHLC(allKeys, token);
      dailyResults = normalizeByInstrumentKey(allKeys, raw);
    } catch (error) {
      console.warn("[prime-scan-all] Daily OHLC batch failed:", error instanceof Error ? error.message : String(error));
    }

    const symbolsWithQuotes = universe.filter((i) => Number(quoteResults[i.instrumentKey]?.last_price) > 0);

    // Sep 12, 2026 is Saturday. On weekends/holidays there is no "today"
    // 5-minute session, so use the last actual NSE session for the candle.
    const ist = nowIST();
    const isWeekend = ist.getUTCDay() === 0 || ist.getUTCDay() === 6;
    const sessionDate = isWeekend ? formatDateIST(getPreviousSessionDate()) : formatDateIST(new Date());

    const toCandle = (c: (string | number)[]): RawCandle => ({ timestamp: String(c[0]), open: Number(c[1]), high: Number(c[2]), low: Number(c[3]), close: Number(c[4]), volume: Number(c[5]) });

    const candleTasks = symbolsWithQuotes.map((instrument) => async () => {
      let raw: unknown[] = [];
      if (market.status === "CLOSED") {
        raw = await fetchHistoricalCandles(instrument.instrumentKey, token, sessionDate, sessionDate).catch(() => []);
      } else {
        raw = await fetchIntradayCandles(instrument.instrumentKey, token).catch(() => []);
      }
      return { symbol: instrument.symbol, intraday: [...(raw as (string | number)[][])].reverse().map(toCandle) };
    });

    const candleResults = await withConcurrency(candleTasks, CANDLE_FETCH_CONCURRENCY);
    const candleMap = new Map<string, { symbol: string; intraday: RawCandle[] }>();
    candleResults.forEach((r) => { if (r) candleMap.set(r.symbol, r); });

    const rows = universe.map((instrument) => {
      const quote = quoteResults[instrument.instrumentKey];
      const daily = dailyResults[instrument.instrumentKey];
      const candles = candleMap.get(instrument.symbol)?.intraday ?? [];
      const ltp = quote?.last_price ?? null;
      const prevClose = quote?.prev_close_price ?? quote?.ohlc?.prev_close ?? daily?.prev_ohlc?.close ?? quote?.ohlc?.close ?? null;
      const dayChangePct = ltp !== null && prevClose !== null && prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : null;

      return scanInstrument({
        symbol: instrument.symbol,
        name: instrument.name,
        instrumentKey: instrument.instrumentKey,
        futuresInstrumentKey: instrument.futuresKey,
        lotSize: instrument.lotSize,
        isin: instrument.isin,
        ltp,
        dayChangePct: dayChangePct !== null ? parseFloat(dayChangePct.toFixed(2)) : null,
        open: quote?.ohlc?.open ?? daily?.live_ohlc?.open ?? null,
        prevClose,
        prevHigh: daily?.prev_ohlc?.high ?? null,
        prevLow: daily?.prev_ohlc?.low ?? null,
        candles5m: candles,
      });
    });

    const ranked = rankScanResults(rows);
    return Response.json({ universeCount: universe.length, scanCount: ranked.length, generatedAt, marketStatus: market.status, upstoxConnected: true, rows: ranked, ...(symbolsWithQuotes.length === 0 ? { error: "UPSTOX_RETURNED_NO_QUOTES_FOR_UNIVERSE" } : {}) } satisfies PrimeScanResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[prime-scan-all] Error:", message);
    return Response.json({ universeCount: universe.length, scanCount: 0, generatedAt, marketStatus: market.status, upstoxConnected: true, rows: [], error: message } satisfies PrimeScanResponse, { status: 500 });
  }
}
