/**
 * Upstox API Client – Server-side ONLY
 */

import axios from "axios";

const UPSTOX_V2_BASE = "https://api.upstox.com/v2";
const UPSTOX_V3_BASE = "https://api.upstox.com/v3";

export interface UpstoxHistoricalCandle {
  0: string;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
}

export interface UpstoxQuote {
  last_price: number;
  net_change: number;
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
  year_high?: number;
  year_low?: number;
}

export interface UpstoxDailyOHLC {
  last_price?: number;
  instrument_token?: string;
  prev_ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ts: number;
  };
  live_ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ts: number;
  };
}

function upstoxHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Api-Version": "2.0",
  };
}

export async function fetchHistoricalCandles(
  instrumentKey: string,
  accessToken: string,
  fromDate?: string,
  toDate?: string
): Promise<UpstoxHistoricalCandle[]> {
  const to = toDate || formatDateIST(new Date());
  const from = fromDate || formatDateIST(offsetDays(new Date(), -5));
  const encodedKey = encodeURIComponent(instrumentKey);
  const url = `${UPSTOX_V3_BASE}/historical-candle/${encodedKey}/minutes/5/${to}/${from}`;
  const response = await axios.get(url, { headers: upstoxHeaders(accessToken), timeout: 10000 });
  return response.data?.data?.candles || [];
}

export async function fetchIntradayCandles(
  instrumentKey: string,
  accessToken: string
): Promise<UpstoxHistoricalCandle[]> {
  const encodedKey = encodeURIComponent(instrumentKey);
  const intradayUrl = `${UPSTOX_V3_BASE}/historical-candle/intraday/${encodedKey}/minutes/5`;

  try {
    const response = await axios.get(intradayUrl, {
      headers: upstoxHeaders(accessToken),
      timeout: 8000,
    });
    const candles = response.data?.data?.candles || [];
    if (Array.isArray(candles) && candles.length > 0) return candles;
  } catch (error) {
    console.warn(`[Upstox] Intraday V3 failed for ${instrumentKey}:`, error instanceof Error ? error.message : String(error));
  }

  const today = formatDateIST(new Date());
  return fetchHistoricalCandles(instrumentKey, accessToken, today, today).catch(() => []);
}

/** Batched previous-session OHLC. */
export async function fetchDailyOHLC(
  instrumentKeys: string[],
  accessToken: string
): Promise<Record<string, UpstoxDailyOHLC>> {
  if (instrumentKeys.length === 0) return {};

  const combined: Record<string, UpstoxDailyOHLC> = {};
  // Keep query strings comfortably sized even for large F&O universes.
  for (let i = 0; i < instrumentKeys.length; i += 50) {
    const chunk = instrumentKeys.slice(i, i + 50);
    const keysParam = chunk.join(",");
    const url = `${UPSTOX_V3_BASE}/market-quote/ohlc?instrument_key=${encodeURIComponent(keysParam)}&interval=1d`;
    const response = await axios.get(url, {
      headers: upstoxHeaders(accessToken),
      timeout: 15000,
    });
    Object.assign(combined, response.data?.data || {});
  }
  return combined;
}

/**
 * Full market quotes V3. Upstox documents up to 500 instruments per request
 * and exposes prev_close_price, year_high and year_low directly.
 */
export async function fetchMarketQuotes(
  instrumentKeys: string[],
  accessToken: string
): Promise<Record<string, UpstoxQuote>> {
  if (instrumentKeys.length === 0) return {};
  const keysParam = instrumentKeys.join(",");
  const url = `${UPSTOX_V3_BASE}/market-quote/quotes?instrument_key=${encodeURIComponent(keysParam)}`;
  const response = await axios.get(url, {
    headers: upstoxHeaders(accessToken),
    timeout: 20000,
  });
  return response.data?.data || {};
}

export async function fetchLTP(
  instrumentKeys: string[],
  accessToken: string
): Promise<Record<string, { last_price: number }>> {
  if (instrumentKeys.length === 0) return {};
  const keysParam = instrumentKeys.join(",");
  const url = `${UPSTOX_V2_BASE}/market-quote/ltp?instrument_key=${encodeURIComponent(keysParam)}`;
  const response = await axios.get(url, { headers: upstoxHeaders(accessToken), timeout: 20000 });
  return response.data?.data || {};
}

export async function fetchUserProfile(accessToken: string): Promise<Record<string, unknown>> {
  const response = await axios.get(`${UPSTOX_V2_BASE}/user/profile`, {
    headers: upstoxHeaders(accessToken),
    timeout: 10000,
  });
  return response.data?.data || {};
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; expires_in?: number; user_id?: string }> {
  const response = await axios.post(
    `${UPSTOX_V2_BASE}/login/authorization/token`,
    new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 }
  );
  return response.data;
}

function formatDateIST(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function offsetDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
