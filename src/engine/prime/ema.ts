/**
 * PRIME TECHNICAL MASTER – 20 EMA Engine
 *
 * 20 EMA serves as context/confirmation per the Prime Technical manual.
 * Calculated on the 5-minute timeframe.
 */

import type { EMAAnalysis, EMAPosition } from "@/domain/prime";

/**
 * Calculate Exponential Moving Average.
 * @param closes - Array of close prices (oldest first)
 * @param period - EMA period (default 20)
 */
export function calculateEMA(closes: number[], period = 20): number | null {
  if (closes.length < period) return null;

  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }

  return parseFloat(ema.toFixed(2));
}

/**
 * Analyse the position of LTP relative to 20 EMA.
 * EMA acts as context for trade direction.
 */
export function analyseEMA(
  closes: number[], // 5-min close series (oldest to newest)
  ltp: number,
  period = 20
): EMAAnalysis {
  const ema20 = calculateEMA(closes, period);

  let position: EMAPosition = "NOT_AVAILABLE";
  let distance: number | null = null;
  let distancePct: number | null = null;

  if (ema20 !== null) {
    distance = parseFloat((ltp - ema20).toFixed(2));
    distancePct =
      ema20 > 0 ? parseFloat(((distance / ema20) * 100).toFixed(2)) : null;

    const threshold = ema20 * 0.001; // 0.1% tolerance for "AT"
    if (Math.abs(distance) <= threshold) {
      position = "AT";
    } else if (ltp > ema20) {
      position = "ABOVE";
    } else {
      position = "BELOW";
    }
  }

  return {
    ema20,
    ltp,
    position,
    distance,
    distancePct,
  };
}
