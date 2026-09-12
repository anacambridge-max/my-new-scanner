/**
 * PRIME TECHNICAL MASTER – Scanner Engine
 *
 * Orchestrates: Level → Reaction → Candle → Volume → 20 EMA → Confirmation → SL → Qty
 *
 * States: WATCH | SETUP | CONFIRMED | FAKE_BREAKOUT | INVALID | NO_TRADE
 *
 * IMPORTANT:
 * - CONFIRMED state is NOT generated from arbitrary thresholds.
 * - The exact numerical confirmation rule is NOT verified from the manual.
 * - CONFIRMED requires all pipeline stages to pass with verified rules.
 * - Until confirmation rules are established: max state is SETUP.
 */

import type {
  PrimeScanRow,
  PrimeScanState,
  PrimeDirection,
  PrimePipelineStage,
  StageResult,
  ReactionAnalysis,
  EMAAnalysis,
  VolumeAnalysis,
  CandleData,
  PrimeLevels,
} from "@/domain/prime";
import { buildPrimeLevels, determinePriceLocation, calculateLevelProximities } from "./levels";
import { analyseCandle, getLatestCandle, type RawCandle } from "./candle";
import { analyseVolume } from "./volume";
import { analyseEMA } from "./ema";
import { analyseReaction, detectFakeBreakout } from "./reaction";

export interface ScanInput {
  symbol: string;
  name: string;
  instrumentKey: string;
  futuresInstrumentKey: string | null;
  lotSize: number;
  isin: string;
  ltp: number | null;
  dayChangePct: number | null;
  open: number | null;
  prevClose: number | null;
  prevHigh: number | null; // Yesterday High
  prevLow: number | null; // Yesterday Low
  candles5m: RawCandle[]; // 5-minute candles (oldest first)
}

/**
 * Determine Prime scanner state from pipeline results.
 *
 * State priority per manual framework:
 * CONFIRMED > SETUP > FAKE_BREAKOUT > WATCH > NO_TRADE > INVALID
 *
 * NOTE: CONFIRMED is withheld until confirmation rules are verified.
 */
function determineState(
  hasLevels: boolean,
  reaction: ReactionAnalysis,
  candle: CandleData | null,
  volume: VolumeAnalysis | null,
  ema: EMAAnalysis | null,
  fakeBreakout: boolean,
  ltp: number | null
): PrimeScanState {
  if (!ltp || !hasLevels) return "INVALID";
  if (!candle) return "WATCH";

  // Fake breakout takes priority over normal setup
  if (fakeBreakout) return "FAKE_BREAKOUT";

  const hasReaction =
    reaction.reactionType === "BULLISH_REACTION" ||
    reaction.reactionType === "BEARISH_REACTION";

  if (!hasReaction) {
    // No level interaction observed
    if (reaction.reactionType === "NEUTRAL") return "WATCH";
    return "WATCH";
  }

  // Has reaction – check supporting factors
  const volumeParticipating =
    volume && (volume.rating === "STAR_1" || volume.rating === "STAR_2" || volume.rating === "STAR_3");

  const emaAligned =
    ema &&
    ((reaction.direction === "BUY" && ema.position === "ABOVE") ||
      (reaction.direction === "SELL" && ema.position === "BELOW"));

  if (hasReaction && volumeParticipating && emaAligned) {
    // All supporting factors present but confirmation rule NOT_VERIFIED
    // → max state is SETUP until confirmation rule is established
    return "SETUP";
  }

  if (hasReaction) {
    return "WATCH";
  }

  return "NO_TRADE";
}

/**
 * Build the Prime pipeline stages for display.
 */
function buildPipeline(
  hasLevels: boolean,
  reaction: ReactionAnalysis,
  candle: CandleData | null,
  volume: VolumeAnalysis | null,
  ema: EMAAnalysis | null
): PrimePipelineStage[] {
  const hasReaction =
    reaction.reactionType === "BULLISH_REACTION" ||
    reaction.reactionType === "BEARISH_REACTION";

  const stageResult = (pass: boolean | null | undefined, fallback: StageResult = "NOT_AVAILABLE"): StageResult => {
    if (pass === null || pass === undefined) return fallback;
    return pass ? "PASS" : "WAIT";
  };

  const levelResult: StageResult = hasLevels ? "PASS" : "NOT_AVAILABLE";

  const reactionResult: StageResult = hasReaction
    ? "PASS"
    : reaction.reactionType === "NEUTRAL"
    ? "WAIT"
    : "NOT_AVAILABLE";

  const candleResult: StageResult = candle
    ? candle.bodyPercent >= 40
      ? "PASS"
      : "WAIT"
    : "NOT_AVAILABLE";

  const volumeResult: StageResult =
    volume && volume.rating !== "NORMAL" ? "PASS" : volume ? "WAIT" : "NOT_AVAILABLE";

  const emaResult: StageResult = ema && ema.ema20 !== null
    ? stageResult(
        (reaction.direction === "BUY" && ema.position === "ABOVE") ||
          (reaction.direction === "SELL" && ema.position === "BELOW"),
        "WAIT"
      )
    : "NOT_AVAILABLE";

  return [
    {
      name: "LEVEL",
      result: levelResult,
      detail: hasLevels ? "YH/YL verified" : "No level data",
    },
    {
      name: "REACTION",
      result: reactionResult,
      detail: reaction.reactionType,
    },
    {
      name: "CANDLE",
      result: candleResult,
      detail: candle ? `${candle.type} | Body ${candle.bodyPercent.toFixed(0)}%` : "No candle",
    },
    {
      name: "VOLUME",
      result: volumeResult,
      detail: volume ? `${volume.ratio.toFixed(1)}× avg` : "No volume",
    },
    {
      name: "20 EMA",
      result: emaResult,
      detail: ema?.ema20 ? `EMA ₹${ema.ema20} | ${ema.position}` : "Insufficient data",
    },
    {
      name: "CONFIRMATION",
      result: "NOT_AVAILABLE", // NOT_VERIFIED per manual
      detail: "Rule not verified from Prime Technical manual",
    },
    {
      name: "SL",
      result: reaction.structuralSL !== null ? "PASS" : "WAIT",
      detail:
        reaction.structuralSL !== null
          ? `Structural SL ₹${reaction.structuralSL}`
          : "Awaiting reaction",
    },
    {
      name: "QTY",
      result: "NOT_AVAILABLE",
      detail: "Requires entry + SL confirmation",
    },
  ];
}

/**
 * Calculate an objective ranking score (documented).
 *
 * Score components (all objective, no invented signals):
 * - State priority: SETUP=30, WATCH=10, FAKE_BREAKOUT=20, NO_TRADE=0, INVALID=0
 * - Volume ratio: min(volumeRatio, 10) × 3 (max 30)
 * - EMA aligned: +15
 * - Close location match: +10 (upper close for BUY, lower for SELL)
 * - Near key level: +15
 *
 * Max possible: 100. This is a scanner ranking score, not investment advice.
 */
function calculateScore(
  state: PrimeScanState,
  direction: PrimeDirection,
  volume: VolumeAnalysis | null,
  ema: EMAAnalysis | null,
  candle: CandleData | null,
  location: string
): { score: number; note: string } {
  let score = 0;
  const parts: string[] = [];

  // State
  if (state === "SETUP") { score += 30; parts.push("SETUP+30"); }
  else if (state === "FAKE_BREAKOUT") { score += 20; parts.push("FAKE_BREAKOUT+20"); }
  else if (state === "WATCH") { score += 10; parts.push("WATCH+10"); }

  // Volume
  if (volume && !volume.isOpeningCandle) {
    const vScore = Math.min(volume.ratio, 10) * 3;
    score += vScore;
    parts.push(`VOL+${vScore.toFixed(0)}`);
  }

  // EMA aligned
  if (ema && ema.ema20 !== null) {
    const aligned =
      (direction === "BUY" && ema.position === "ABOVE") ||
      (direction === "SELL" && ema.position === "BELOW");
    if (aligned) { score += 15; parts.push("EMA+15"); }
  }

  // Close location
  if (candle) {
    if (
      (direction === "BUY" && candle.closeLocation === "UPPER") ||
      (direction === "SELL" && candle.closeLocation === "LOWER")
    ) {
      score += 10;
      parts.push("CLOSE_LOC+10");
    }
  }

  // Near level
  if (location === "NEAR_YH" || location === "NEAR_YL") {
    score += 15;
    parts.push("NEAR_LEVEL+15");
  }

  return {
    score: Math.round(score),
    note: `Scanner ranking (not investment advice): ${parts.join(", ") || "base"}`,
  };
}

/**
 * Build human-readable reason string.
 */
function buildReason(
  reaction: ReactionAnalysis,
  volume: VolumeAnalysis | null,
  ema: EMAAnalysis | null,
  state: PrimeScanState,
  location: string
): string {
  const parts: string[] = [];

  parts.push(reaction.detail);

  if (volume) {
    if (volume.isOpeningCandle) {
      parts.push("Opening candle volume — treated separately from intraday comparisons.");
    } else if (volume.rating !== "NORMAL") {
      const stars = volume.rating === "STAR_3" ? "★★★" : volume.rating === "STAR_2" ? "★★" : "★";
      parts.push(`Volume ${stars} (${volume.ratio.toFixed(1)}× avg).`);
    } else {
      parts.push("Volume NORMAL — no unusual participation.");
    }
  }

  if (ema && ema.ema20) {
    parts.push(`20 EMA ₹${ema.ema20} — price ${ema.position}.`);
  }

  if (state === "SETUP") {
    parts.push("Confirmation rule NOT VERIFIED per Prime Technical manual — awaiting verified confirmation signal.");
  } else if (state === "WATCH") {
    parts.push("Watch candidate. Await setup formation.");
  } else if (state === "FAKE_BREAKOUT") {
    parts.push("Potential fake breakout pattern. Await confirmation for counter-trade.");
  } else if (state === "NO_TRADE") {
    parts.push("No qualifying setup.");
  }

  return parts.join(" ");
}

/**
 * Main scanner function – processes a single instrument.
 */
export function scanInstrument(input: ScanInput): PrimeScanRow {
  const {
    symbol, name, instrumentKey, futuresInstrumentKey,
    lotSize, isin, ltp, dayChangePct, open, prevClose,
    prevHigh, prevLow, candles5m,
  } = input;

  const updatedAt = new Date().toISOString();
  const dataFresh = candles5m.length > 0;

  // ── Levels ──────────────────────────────────────────────────────────────
  const hasLevels = prevHigh !== null && prevLow !== null && prevHigh > 0 && prevLow > 0;
  const levels: PrimeLevels | null = hasLevels
    ? buildPrimeLevels(prevHigh!, prevLow!)
    : null;

  // ── Latest 5-min candle ─────────────────────────────────────────────────
  const rawCandle = getLatestCandle(candles5m);
  const candle: CandleData | null = rawCandle ? analyseCandle(rawCandle) : null;

  // ── Volume ──────────────────────────────────────────────────────────────
  const volume: VolumeAnalysis | null =
    candle && candles5m.length > 1
      ? analyseVolume(
          candle.volume,
          candles5m.map((c) => c.volume),
          candle.timestamp
        )
      : null;

  // ── EMA ─────────────────────────────────────────────────────────────────
  const closes = candles5m.map((c) => c.close);
  const ema: EMAAnalysis | null =
    closes.length >= 2 && ltp !== null
      ? analyseEMA(closes, ltp)
      : null;

  // ── Reaction ─────────────────────────────────────────────────────────────
  const reaction = levels && candle && ltp !== null
    ? analyseReaction(candle, levels, ltp)
    : {
        levelTouched: null,
        reactionType: "NO_INTERACTION" as const,
        direction: "NEUTRAL" as const,
        structuralSL: null,
        confirmationStatus: "NOT_AVAILABLE" as const,
        detail: hasLevels
          ? "No candle data available for reaction analysis."
          : "YH/YL levels not available.",
      };

  // ── Fake Breakout ────────────────────────────────────────────────────────
  let fakeBreakout = false;
  if (levels && candles5m.length >= 2) {
    const candleHistory = candles5m.map((c) => analyseCandle(c));
    const fboYH = detectFakeBreakout(candleHistory, levels.yh, "UP");
    const fboYL = detectFakeBreakout(candleHistory, levels.yl, "DOWN");
    fakeBreakout = fboYH.detected || fboYL.detected;
  }

  // ── Price Location ────────────────────────────────────────────────────────
  const location =
    levels && ltp !== null
      ? determinePriceLocation(ltp, levels)
      : "INSUFFICIENT_DATA";

  // ── Scanner State ─────────────────────────────────────────────────────────
  const state = determineState(
    hasLevels,
    reaction,
    candle,
    volume,
    ema,
    fakeBreakout,
    ltp
  );

  const direction = reaction.direction;

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const pipeline = buildPipeline(hasLevels, reaction, candle, volume, ema);

  // ── Score ─────────────────────────────────────────────────────────────────
  const { score, note: scoreNote } = calculateScore(
    state, direction, volume, ema, candle, location
  );

  // ── Reason ────────────────────────────────────────────────────────────────
  const reason = buildReason(reaction, volume, ema, state, location);

  // ── Risk (requires confirmed entry + SL) ─────────────────────────────────
  // Entry and qty are NOT calculated without a verified confirmation rule.
  const sl = reaction.structuralSL;
  const entry: number | null = null; // cannot derive without confirmation rule
  const riskPerShare = entry !== null && sl !== null
    ? parseFloat(Math.abs(entry - sl).toFixed(2))
    : null;
  const qty: number | null = null; // Requires entry + SL

  return {
    symbol,
    name,
    instrumentKey,
    futuresInstrumentKey,
    lotSize,
    isin,
    ltp,
    dayChangePct,
    open,
    prevClose,
    yh: levels?.yh ?? null,
    yl: levels?.yl ?? null,
    mid: null,
    r1: null,
    r2: null,
    r3: null,
    s1: null,
    s2: null,
    s3: null,
    levelsVerificationNote: "PENDING_RULE_VERIFICATION",
    location,
    reaction,
    candle,
    volume,
    ema,
    state,
    direction,
    pipeline,
    entry,
    sl,
    riskPerShare,
    qty,
    score,
    scoreNote,
    rank: 0, // assigned by scanner after sorting
    reason,
    updatedAt,
    dataFresh,
  };
}

/**
 * Rank and sort scan rows by state priority + score.
 *
 * Priority: CONFIRMED > SETUP > FAKE_BREAKOUT > WATCH > NO_TRADE > INVALID
 */
function statePriority(state: PrimeScanState): number {
  switch (state) {
    case "CONFIRMED": return 6;
    case "SETUP": return 5;
    case "FAKE_BREAKOUT": return 4;
    case "WATCH": return 3;
    case "NO_TRADE": return 2;
    case "INVALID": return 1;
    default: return 0;
  }
}

export function rankScanResults(rows: PrimeScanRow[]): PrimeScanRow[] {
  const sorted = [...rows].sort((a, b) => {
    const sp = statePriority(b.state) - statePriority(a.state);
    if (sp !== 0) return sp;
    return b.score - a.score;
  });

  return sorted.map((row, idx) => ({ ...row, rank: idx + 1 }));
}
