/**
 * PRIME TECHNICAL MASTER – Levels Engine
 *
 * VERIFIED levels (from manual):
 *   - Yesterday High (YH)
 *   - Yesterday Low (YL)
 *
 * NOT VERIFIED (exact formula not established from manual):
 *   - MID
 *   - R1, R2, R3
 *   - S1, S2, S3
 *
 * DO NOT substitute a standard pivot formula without verification.
 */

import type { PrimeLevels, LevelProximity } from "@/domain/prime";

/**
 * Build Prime levels from previous session data.
 * Only YH and YL are populated; all others remain null pending rule verification.
 */
export function buildPrimeLevels(
  prevHigh: number,
  prevLow: number
): PrimeLevels {
  return {
    yh: parseFloat(prevHigh.toFixed(2)),
    yl: parseFloat(prevLow.toFixed(2)),
    midVerified: false,
    r1Verified: false,
    r2Verified: false,
    r3Verified: false,
    s1Verified: false,
    s2Verified: false,
    s3Verified: false,
  };
}

/**
 * Determine the current price location relative to key verified levels.
 */
export function determinePriceLocation(
  ltp: number,
  levels: PrimeLevels
): string {
  const { yh, yl } = levels;
  const range = yh - yl;

  if (range <= 0) return "INSUFFICIENT_DATA";

  const yhProximityPct = Math.abs((ltp - yh) / yh) * 100;
  const ylProximityPct = Math.abs((ltp - yl) / yl) * 100;

  if (ltp > yh) return "ABOVE_YH";
  if (yhProximityPct <= 0.5) return "NEAR_YH";
  if (ltp < yl) return "BELOW_YL";
  if (ylProximityPct <= 0.5) return "NEAR_YL";

  // Position within yesterday's range
  const posInRange = (ltp - yl) / range;
  if (posInRange >= 0.67) return "UPPER_RANGE";
  if (posInRange <= 0.33) return "LOWER_RANGE";
  return "MID_RANGE";
}

/**
 * Calculate proximity to each level for display purposes.
 */
export function calculateLevelProximities(
  ltp: number,
  levels: PrimeLevels
): LevelProximity[] {
  const proximities: LevelProximity[] = [];

  const addLevel = (
    name: string,
    value: number,
    verified: boolean
  ) => {
    const distance = Math.abs(ltp - value);
    const distancePct =
      value > 0 ? parseFloat(((distance / value) * 100).toFixed(2)) : 0;
    const side: "ABOVE" | "BELOW" | "AT" =
      ltp > value ? "ABOVE" : ltp < value ? "BELOW" : "AT";
    proximities.push({
      level: name,
      value,
      distance: parseFloat(distance.toFixed(2)),
      distancePct,
      side,
      verified,
    });
  };

  addLevel("YH", levels.yh, true);
  addLevel("YL", levels.yl, true);
  // MID/R/S not added because formula is not verified

  return proximities.sort((a, b) => a.distance - b.distance);
}
