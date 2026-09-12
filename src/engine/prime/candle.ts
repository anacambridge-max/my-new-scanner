/**
 * PRIME TECHNICAL MASTER – Candle Engine
 *
 * 5-minute candle is the central execution timeframe per the Prime Technical manual.
 * Analyses: OHLC, body, wicks, range, close location.
 */

import type {
  CandleData,
  CandleType,
  CloseLocation,
} from "@/domain/prime";

export interface RawCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function analyseCandle(raw: RawCandle): CandleData {
  const { timestamp, open, high, low, close, volume } = raw;

  const range = high - low;
  const body = Math.abs(close - open);
  const upperWick =
    close >= open ? high - close : high - open;
  const lowerWick =
    close >= open ? open - low : close - low;
  const bodyPercent = range > 0 ? (body / range) * 100 : 0;

  // Close location within candle range
  let closeLocation: CloseLocation = "UNKNOWN";
  if (range > 0) {
    const closePct = (close - low) / range;
    if (closePct >= 0.67) closeLocation = "UPPER";
    else if (closePct <= 0.33) closeLocation = "LOWER";
    else closeLocation = "MIDDLE";
  }

  // Candle type
  let type: CandleType;
  if (bodyPercent < 5) {
    type = "DOJI";
  } else if (close > open) {
    type = "BULLISH";
  } else if (close < open) {
    type = "BEARISH";
  } else {
    type = "NEUTRAL";
  }

  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    range: parseFloat(range.toFixed(2)),
    body: parseFloat(body.toFixed(2)),
    upperWick: parseFloat(upperWick.toFixed(2)),
    lowerWick: parseFloat(lowerWick.toFixed(2)),
    bodyPercent: parseFloat(bodyPercent.toFixed(1)),
    closeLocation,
    type,
  };
}

/**
 * Detect if a timestamp corresponds to the opening candle (09:15–09:20 IST).
 * The opening candle has structurally different volume characteristics
 * and must not be compared directly to normal intraday candles.
 */
export function isOpeningCandle(timestamp: string): boolean {
  const date = new Date(timestamp);
  // Convert to IST (UTC+5:30)
  const istMs = date.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  // 09:15 to 09:20
  if (hours === 9 && minutes >= 15 && minutes < 20) return true;
  return false;
}

/**
 * Returns the most recent complete 5-minute candle from a series.
 */
export function getLatestCandle(candles: RawCandle[]): RawCandle | null {
  if (!candles || candles.length === 0) return null;
  return candles[candles.length - 1];
}
