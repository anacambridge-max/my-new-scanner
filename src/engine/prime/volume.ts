/**
 * PRIME TECHNICAL MASTER – Volume Engine
 *
 * Source: Prime Technical AFL
 * - 20-period average volume is the baseline
 * - 2× average = STAR_1
 * - 4× average = STAR_2
 * - 6.5× average = STAR_3
 *
 * IMPORTANT: Volume alone is NOT a BUY/SELL signal.
 * The opening 09:15–09:20 candle must be treated separately.
 */

import type { VolumeAnalysis, VolumeRating } from "@/domain/prime";
import { isOpeningCandle } from "./candle";

const AVG_PERIOD = 20;

/**
 * Classify volume ratio into star rating per Prime Technical manual.
 */
export function classifyVolume(ratio: number): VolumeRating {
  if (ratio >= 6.5) return "STAR_3";
  if (ratio >= 4.0) return "STAR_2";
  if (ratio >= 2.0) return "STAR_1";
  return "NORMAL";
}

/**
 * Calculate 20-period volume average from a series.
 * Excludes the current (in-progress) candle from the average calculation.
 */
export function calculate20AvgVolume(
  volumeSeries: number[],
  excludeLast = true
): number {
  const series = excludeLast ? volumeSeries.slice(0, -1) : volumeSeries;
  if (series.length === 0) return 0;
  const slice = series.slice(-AVG_PERIOD);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / slice.length;
}

/**
 * Analyse volume for the current candle.
 */
export function analyseVolume(
  currentVolume: number,
  volumeSeries: number[], // includes current candle at end
  currentTimestamp: string
): VolumeAnalysis {
  const avg20 = calculate20AvgVolume(volumeSeries, true);
  const ratio = avg20 > 0 ? currentVolume / avg20 : 0;
  const rating = classifyVolume(ratio);
  const isOpening = isOpeningCandle(currentTimestamp);

  return {
    current: currentVolume,
    avgPeriod: AVG_PERIOD,
    avg20: parseFloat(avg20.toFixed(0)),
    ratio: parseFloat(ratio.toFixed(2)),
    rating,
    isOpeningCandle: isOpening,
  };
}

/**
 * Human-readable volume label for display.
 */
export function volumeLabel(rating: VolumeRating): string {
  switch (rating) {
    case "STAR_3":
      return "★★★";
    case "STAR_2":
      return "★★";
    case "STAR_1":
      return "★";
    default:
      return "NORMAL";
  }
}
