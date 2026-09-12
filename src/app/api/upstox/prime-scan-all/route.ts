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
      try { results[current] = await tasks[current](); }
      catch { results[current] = null; }
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

async function fetchQuotesResilient(keys: string[], token: string): Promise<Record<string, Quote>> {
  try {
    const raw = await fetchMarketQuotes(keys, token) as Record<string, Quote>;
    const normalized = normalizeByInstrumentKey(keys, raw);
    if (Object.keys(normalized).length) return normalized;
  } catch (e) { console.warn("[prime] quote batch failed", e instanceof Error ? e.message : String(e)); }
  const tasks = keys.map(key => async () => {
    const raw = await fetchMarketQuotes([key], token) as Record<string, Quote>;
    const normalized = normalizeByInstrumentKey([key], raw);
    return { key, quote: normalized[key] ?? Object.values(raw || {})[0] ?? null };
  });
  const results = await withConcurrency(tasks, QUOTE_FALLBACK_CONCURRENCY);
  const out: Record<string, Quote> = {};
  for (const r of results) if (r?.quote) out[r.key] = r.quote;
  return out;
}

function dateDaysAgo(dateString: string, days: number): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return formatDateIST(d);
}

function toRawCandle(c: (string | number)[]): RawCandle {
  return {
    timestamp: String(c[0]),
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4]),
    volume: Number(c[5]),
  };
}

function normalizeCandleOrder(raw: unknown[]): RawCandle[] {
  return (raw as (string | number)[][])
    .filter(c => Array.isArray(c) && c.length >= 6)
    .map(toRawCandle)
    .filter(c => Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function GET() {
  const token = await getValidToken();
  const market = getMarketStatus();
  const universe = await getFnOUniverse();
  const generatedAt = new Date().toISOString();
  if (!token) return Response.json({ universeCount: universe.length, scanCount: 0, generatedAt, marketStatus: market.status, upstoxConnected: false, rows: [], error: "UPSTOX_DISCONNECTED_OR_EXPIRED" } satisfies PrimeScanResponse, { status: 401 });

  try {
    const keys = universe.map(i => i.instrumentKey);
    const quotes = await fetchQuotesResilient(keys, token);
    let daily: Record<string, DailyOHLC> = {};
    try { daily = normalizeByInstrumentKey(keys, await fetchDailyOHLC(keys, token)); }
    catch (e) { console.warn("[prime] daily OHLC batch failed", e instanceof Error ? e.message : String(e)); }

    const withQuotes = universe.filter(i => Number(quotes[i.instrumentKey]?.last_price) > 0);
    const ist = nowIST();
    const weekend = ist.getUTCDay() === 0 || ist.getUTCDay() === 6;
    const lastSession = formatDateIST(getPreviousSessionDate());

    const candleTasks = withQuotes.map(instrument => async () => {
      let raw: unknown[] = [];
      if (market.status === "CLOSED") {
        // V3 permits up to one month for 1–15 minute historical candles.
        // Fetch a full 30-day window so the 20 EMA is initialized from enough
        // 5-minute closes instead of a short 5-day sample.
        const from = dateDaysAgo(lastSession, 30);
        raw = await fetchHistoricalCandles(instrument.instrumentKey, token, from, lastSession).catch(() => []);
      } else {
        raw = await fetchIntradayCandles(instrument.instrumentKey, token).catch(() => []);
      }
      return { symbol: instrument.symbol, intraday: normalizeCandleOrder(raw) };
    });
    const candleResults = await withConcurrency(candleTasks, CANDLE_FETCH_CONCURRENCY);
    const candleMap = new Map<string, { symbol: string; intraday: RawCandle[] }>();
    candleResults.forEach(r => { if (r) candleMap.set(r.symbol, r); });

    const rows = universe.map(instrument => {
      const q = quotes[instrument.instrumentKey];
      const d = daily[instrument.instrumentKey];
      const candles = candleMap.get(instrument.symbol)?.intraday ?? [];
      const ltp = q?.last_price ?? null;
      const prevClose = q?.prev_close_price ?? q?.ohlc?.prev_close ?? d?.prev_ohlc?.close ?? q?.ohlc?.close ?? null;
      const dayChangePct = ltp !== null && prevClose !== null && prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : null;
      const prevHigh = d?.prev_ohlc?.high ?? (market.status === "CLOSED" ? q?.ohlc?.high : null) ?? null;
      const prevLow = d?.prev_ohlc?.low ?? (market.status === "CLOSED" ? q?.ohlc?.low : null) ?? null;
      return scanInstrument({
        symbol: instrument.symbol, name: instrument.name, instrumentKey: instrument.instrumentKey,
        futuresInstrumentKey: instrument.futuresKey, lotSize: instrument.lotSize, isin: instrument.isin,
        ltp, dayChangePct: dayChangePct !== null ? Number(dayChangePct.toFixed(2)) : null,
        open: q?.ohlc?.open ?? d?.live_ohlc?.open ?? null,
        prevClose, prevHigh, prevLow, candles5m: candles,
      });
    });

    const ranked = rankScanResults(rows);
    return Response.json({ universeCount: universe.length, scanCount: ranked.length, generatedAt, marketStatus: market.status, upstoxConnected: true, rows: ranked, ...(withQuotes.length === 0 ? { error: "UPSTOX_RETURNED_NO_QUOTES_FOR_UNIVERSE" } : {}) } satisfies PrimeScanResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[prime] scan error", message);
    return Response.json({ universeCount: universe.length, scanCount: 0, generatedAt, marketStatus: market.status, upstoxConnected: true, rows: [], error: message } satisfies PrimeScanResponse, { status: 500 });
  }
}
