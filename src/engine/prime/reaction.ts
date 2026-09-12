/**
 * PRIME TECHNICAL MASTER – Reaction Engine
 *
 * Core principle: "Do not trade the line. Trade the reaction to the line."
 *
 * A reaction is observed AFTER price touches/approaches a key level.
 * The candle(s) AFTER the touch determine setup direction.
 *
 * CONFIRMATION is explicitly marked NOT_VERIFIED because the exact
 * numerical confirmation rule is not established from the manual.
 */

import type {
  ReactionAnalysis,
  ReactionType,
  PrimeDirection,
  CandleData,
  PrimeLevels,
} from "@/domain/prime";

const PROXIMITY_PCT = 0.5; // within 0.5% of level = "touched"

function pctDistance(price: number, level: number): number {
  if (level === 0) return 999;
  return Math.abs((price - level) / level) * 100;
}

function touchedLevel(candle: CandleData, levelValue: number): boolean {
  // Price touched if the candle's range overlaps the level
  return (
    candle.low <= levelValue * (1 + PROXIMITY_PCT / 100) &&
    candle.high >= levelValue * (1 - PROXIMITY_PCT / 100)
  );
}

/**
 * Analyse the reaction to key levels based on the latest candle.
 *
 * "Do not trade the line. Trade the reaction to the line."
 */
export function analyseReaction(
  candle: CandleData,
  levels: PrimeLevels,
  ltp: number
): ReactionAnalysis {
  const yhTouched = touchedLevel(candle, levels.yh);
  const ylTouched = touchedLevel(candle, levels.yl);

  let levelTouched: string | null = null;
  let reactionType: ReactionType = "NO_INTERACTION";
  let direction: PrimeDirection = "NEUTRAL";
  let structuralSL: number | null = null;
  let detail = "No key level interaction on current candle.";

  if (yhTouched) {
    levelTouched = `YH (₹${levels.yh})`;

    // Reaction to YH:
    // Bullish reaction = price holds above / closes above YH after test
    // Bearish reaction = price rejects from YH / closes below YH
    if (candle.close > levels.yh) {
      reactionType = "BULLISH_REACTION";
      direction = "BUY";
      structuralSL = parseFloat(candle.low.toFixed(2));
      detail = `YH (₹${levels.yh}) touched; bullish reaction observed – close above YH. Structural SL at candle low ₹${structuralSL}.`;
    } else if (candle.close < levels.yh && candle.type === "BEARISH") {
      reactionType = "BEARISH_REACTION";
      direction = "SELL";
      structuralSL = parseFloat(candle.high.toFixed(2));
      detail = `YH (₹${levels.yh}) touched; bearish rejection observed – close below YH. Structural SL at candle high ₹${structuralSL}.`;
    } else {
      reactionType = "NEUTRAL";
      direction = "NEUTRAL";
      detail = `YH (₹${levels.yh}) touched; reaction not yet clear. Await next candle.`;
    }
  } else if (ylTouched) {
    levelTouched = `YL (₹${levels.yl})`;

    if (candle.close < levels.yl) {
      reactionType = "BEARISH_REACTION";
      direction = "SELL";
      structuralSL = parseFloat(candle.high.toFixed(2));
      detail = `YL (₹${levels.yl}) touched; bearish reaction observed – close below YL. Structural SL at candle high ₹${structuralSL}.`;
    } else if (candle.close > levels.yl && candle.type === "BULLISH") {
      reactionType = "BULLISH_REACTION";
      direction = "BUY";
      structuralSL = parseFloat(candle.low.toFixed(2));
      detail = `YL (₹${levels.yl}) touched; bullish reaction observed – close above YL. Structural SL at candle low ₹${structuralSL}.`;
    } else {
      reactionType = "NEUTRAL";
      direction = "NEUTRAL";
      detail = `YL (₹${levels.yl}) touched; reaction not yet clear. Await next candle.`;
    }
  } else {
    // Check proximity even if not "touched"
    const yhDist = pctDistance(ltp, levels.yh);
    const ylDist = pctDistance(ltp, levels.yl);

    if (yhDist <= 1.0) {
      detail = `Price approaching YH (₹${levels.yh}); watch for reaction. Do not trade the line.`;
    } else if (ylDist <= 1.0) {
      detail = `Price approaching YL (₹${levels.yl}); watch for reaction. Do not trade the line.`;
    } else {
      detail = `No YH/YL interaction on current candle. Price location: YH ₹${levels.yh} (+${yhDist.toFixed(1)}%), YL ₹${levels.yl} (-${ylDist.toFixed(1)}%).`;
    }
  }

  // CONFIRMATION: explicitly NOT_VERIFIED because the exact rule is not
  // established from the Prime Technical manual.
  return {
    levelTouched,
    reactionType,
    direction,
    structuralSL,
    confirmationStatus: "NOT_VERIFIED",
    detail,
  };
}

/**
 * Detect potential fake breakout scenario.
 *
 * Sequence: BREAK → FAILURE TO HOLD → RECLAIM/CLOSE → CONFIRMATION → OPPOSITE TRADE
 *
 * A fake breakout requires candle sequence analysis over multiple bars.
 * Single-candle crossing does NOT constitute a fake breakout signal.
 */
export function detectFakeBreakout(
  candles: CandleData[],
  level: number,
  side: "UP" | "DOWN"
): {
  detected: boolean;
  detail: string;
} {
  if (candles.length < 2) {
    return {
      detected: false,
      detail: "Insufficient candle data for fake breakout detection.",
    };
  }

  const prev = candles[candles.length - 2];
  const curr = candles[candles.length - 1];

  if (side === "UP") {
    // Fake UP breakout: previous closed above level, current closes back below
    if (prev.close > level && curr.close < level) {
      return {
        detected: true,
        detail: `Potential fake breakout above ₹${level}: previous close ₹${prev.close} broke above, current close ₹${curr.close} reclaimed below. Await confirmation for SHORT trade.`,
      };
    }
  } else {
    // Fake DOWN breakout: previous closed below level, current closes back above
    if (prev.close < level && curr.close > level) {
      return {
        detected: true,
        detail: `Potential fake breakdown below ₹${level}: previous close ₹${prev.close} broke below, current close ₹${curr.close} reclaimed above. Await confirmation for LONG trade.`,
      };
    }
  }

  return {
    detected: false,
    detail: "No fake breakout pattern detected on current candle sequence.",
  };
}
