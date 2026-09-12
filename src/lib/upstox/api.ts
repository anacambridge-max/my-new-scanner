/**
 * Upstox API Client – Server-side ONLY
 *
 * All calls authenticated with server-side access token.
 * NEVER expose the access token to client code.
 */

import axios from "axios";

const UPSTOX_BASE = "https://api.upstox.com/v2";

export interface UpstoxHistoricalCandle {
  // [timestamp, open, high, low, close, volume, oi]
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
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
    prev_close?: number;
  };
  volume?: number;
}

function upstoxHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Api-Version": "2.0",
  };
}

/**
 * Fetch historical 5-minute candles for an instrument.
 */
export async function fetchHistoricalCandles(
  instrumentKey: string,
  accessToken: string,
  fromDate?: string, // YYYY-MM-DD
  toDate?: string    // YYYY-MM-DD
): Promise<UpstoxHistoricalCandle[]> {
  const to = toDate || formatDate(new Date());
  const from = fromDate || formatDate(offsetDays(new Date(), -5));

  // URL encode the instrument key
  const encodedKey = encodeURIComponent(instrumentKey);

  const url = `${UPSTOX_BASE}/historical-candle/${encodedKey}/5minute/${to}/${from}`;

  const response = await axios.get(url, {
    headers: upstoxHeaders(accessToken),
    timeout: 15000,
  });

  return response.data?.data?.candles || [];
}

/**
 * Fetch intraday 5-minute candles (today's session).
 */
export async function fetchIntradayCandles(
  instrumentKey: string,
  accessToken: string
): Promise<UpstoxHistoricalCandle[]> {
  const encodedKey = encodeURIComponent(instrumentKey);
  const url = `${UPSTOX_BASE}/historical-candle/intraday/${encodedKey}/5minute`;

  const response = await axios.get(url, {
    headers: upstoxHeaders(accessToken),
    timeout: 15000,
  });

  return response.data?.data?.candles || [];
}

/**
 * Fetch full market quotes for a batch of instruments.
 * Upstox supports up to ~500 instruments per request.
 */
export async function fetchMarketQuotes(
  instrumentKeys: string[],
  accessToken: string
): Promise<Record<string, UpstoxQuote>> {
  if (instrumentKeys.length === 0) return {};

  const keysParam = instrumentKeys.join(",");
  const url = `${UPSTOX_BASE}/market-quote/quotes?instrument_key=${encodeURIComponent(keysParam)}`;

  const response = await axios.get(url, {
    headers: upstoxHeaders(accessToken),
    timeout: 20000,
  });

  return response.data?.data || {};
}

/**
 * Fetch LTP (Last Traded Price) for a batch of instruments.
 * Lighter than full quote.
 */
export async function fetchLTP(
  instrumentKeys: string[],
  accessToken: string
): Promise<Record<string, { last_price: number }>> {
  if (instrumentKeys.length === 0) return {};

  const keysParam = instrumentKeys.join(",");
  const url = `${UPSTOX_BASE}/market-quote/ltp?instrument_key=${encodeURIComponent(keysParam)}`;

  const response = await axios.get(url, {
    headers: upstoxHeaders(accessToken),
    timeout: 20000,
  });

  return response.data?.data || {};
}

/**
 * Get user profile to verify token validity.
 */
export async function fetchUserProfile(
  accessToken: string
): Promise<Record<string, unknown>> {
  const url = `${UPSTOX_BASE}/user/profile`;
  const response = await axios.get(url, {
    headers: upstoxHeaders(accessToken),
    timeout: 10000,
  });
  return response.data?.data || {};
}

/**
 * Exchange authorization code for access token.
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  token_type: string;
  expires_in?: number;
  user_id?: string;
}> {
  const response = await axios.post(
    "https://api.upstox.com/v2/login/authorization/token",
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    }
  );
  return response.data;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function offsetDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
