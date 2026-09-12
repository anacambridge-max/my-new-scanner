/**
 * PRIME TECHNICAL MASTER – Scanner Engine
 *
 * Orchestrates: Level → Reaction → Candle → Volume → 20 EMA → Confirmation → SL → Qty
 *
 * States: WATCH | SETUP | CONFIRMED | FAKE_BREAKOUT | INVALID | NO_TRADE
 */

import type {
  PrimeScanRow, PrimeScanState, PrimeDirection, PrimePipelineStage,
  StageResult, ReactionAnalysis, EMAAnalysis, VolumeAnalysis, CandleData, PrimeLevels,
} from "@/domain/prime";
import { buildPrimeLevels, determinePriceLocation } from "./levels";
import { analyseCandle, getLatestCandle, type RawCandle } from "./candle";
import { analyseVolume } from "./volume";
import { analyseEMA } from "./ema";
import { analyseReaction, detectFakeBreakout } from "./reaction";
import { findHistoricalPrimeSignal } from "./historical";

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
  prevHigh: number | null;
  prevLow: number | null;
  candles5m: RawCandle[];
}

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
  if (fakeBreakout) return "FAKE_BREAKOUT";

  const hasReaction = reaction.reactionType === "BULLISH_REACTION" || reaction.reactionType === "BEARISH_REACTION";
  if (!hasReaction) return "WATCH";

  const volumeParticipating = !!volume && ["STAR_1", "STAR_2", "STAR_3"].includes(volume.rating);
  const emaAligned = !!ema && (
    (reaction.direction === "BUY" && ema.position === "ABOVE") ||
    (reaction.direction === "SELL" && ema.position === "BELOW")
  );

  if (volumeParticipating && emaAligned) return "SETUP";
  return "WATCH";
}

function buildPipeline(
  hasLevels: boolean,
  reaction: ReactionAnalysis,
  candle: CandleData | null,
  volume: VolumeAnalysis | null,
  ema: EMAAnalysis | null
): PrimePipelineStage[] {
  const hasReaction = reaction.reactionType === "BULLISH_REACTION" || reaction.reactionType === "BEARISH_REACTION";
  const stageResult = (pass: boolean | null | undefined, fallback: StageResult = "NOT_AVAILABLE"): StageResult => {
    if (pass === null || pass === undefined) return fallback;
    return pass ? "PASS" : "WAIT";
  };

  return [
    { name: "LEVEL", result: hasLevels ? "PASS" : "NOT_AVAILABLE", detail: hasLevels ? "YH/YL verified" : "No level data" },
    { name: "REACTION", result: hasReaction ? "PASS" : reaction.reactionType === "NEUTRAL" ? "WAIT" : "NOT_AVAILABLE", detail: reaction.reactionType },
    { name: "CANDLE", result: candle ? candle.bodyPercent >= 40 ? "PASS" : "WAIT" : "NOT_AVAILABLE", detail: candle ? `${candle.type} | Body ${candle.bodyPercent.toFixed(0)}%` : "No candle" },
    { name: "VOLUME", result: volume && volume.rating !== "NORMAL" ? "PASS" : volume ? "WAIT" : "NOT_AVAILABLE", detail: volume ? `${volume.ratio.toFixed(1)}× avg` : "No volume" },
    { name: "20 EMA", result: ema && ema.ema20 !== null ? stageResult((reaction.direction === "BUY" && ema.position === "ABOVE") || (reaction.direction === "SELL" && ema.position === "BELOW"), "WAIT") : "NOT_AVAILABLE", detail: ema?.ema20 ? `EMA ₹${ema.ema20} | ${ema.position}` : "Insufficient data" },
    { name: "CONFIRMATION", result: "NOT_AVAILABLE", detail: "Rule not verified from Prime Technical manual" },
    { name: "SL", result: reaction.structuralSL !== null ? "PASS" : "WAIT", detail: reaction.structuralSL !== null ? `Structural SL ₹${reaction.structuralSL}` : "Awaiting reaction" },
    { name: "QTY", result: "NOT_AVAILABLE", detail: "Requires entry + SL confirmation" },
  ];
}

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
  if (state === "SETUP") { score += 30; parts.push("SETUP+30"); }
  else if (state === "FAKE_BREAKOUT") { score += 20; parts.push("FAKE_BREAKOUT+20"); }
  else if (state === "WATCH") { score += 10; parts.push("WATCH+10"); }
  if (volume && !volume.isOpeningCandle) {
    const vScore = Math.min(volume.ratio, 10) * 3;
    score += vScore;
    parts.push(`VOL+${vScore.toFixed(0)}`);
  }
  if (ema && ema.ema20 !== null) {
    const aligned = (direction === "BUY" && ema.position === "ABOVE") || (direction === "SELL" && ema.position === "BELOW");
    if (aligned) { score += 15; parts.push("EMA+15"); }
  }
  if (candle && ((direction === "BUY" && candle.closeLocation === "UPPER") || (direction === "SELL" && candle.closeLocation === "LOWER"))) {
    score += 10; parts.push("CLOSE_LOC+10");
  }
  if (location === "NEAR_YH" || location === "NEAR_YL") { score += 15; parts.push("NEAR_LEVEL+15"); }
  return { score: Math.round(score), note: `Scanner ranking (not investment advice): ${parts.join(", ") || "base"}` };
}

function buildReason(
  reaction: ReactionAnalysis,
  volume: VolumeAnalysis | null,
  ema: EMAAnalysis | null,
  state: PrimeScanState
): string {
  const parts: string[] = [reaction.detail];
  if (volume) {
    if (volume.isOpeningCandle) parts.push("Opening candle volume — treated separately from intraday comparisons.");
    else if (volume.rating !== "NORMAL") {
      const stars = volume.rating === "STAR_3" ? "★★★" : volume.rating === "STAR_2" ? "★★" : "★";
      parts.push(`Volume ${stars} (${volume.ratio.toFixed(1)}× avg).`);
    } else parts.push("Volume NORMAL — no unusual participation.");
  }
  if (ema && ema.ema20) parts.push(`20 EMA ₹${ema.ema20} — price ${ema.position}.`);
  if (state === "SETUP") parts.push("Current candle meets the scanner's reaction/volume/EMA context.");
  else if (state === "WATCH") parts.push("Watch candidate. Await setup formation.");
  else if (state === "FAKE_BREAKOUT") parts.push("Potential fake breakout pattern. Await confirmation for counter-trade.");
  else if (state === "NO_TRADE") parts.push("No qualifying setup.");
  return parts.join(" ");
}

function safeHistoricalDetail(candles5m: RawCandle[]): PrimePipelineStage {
  try {
    const historical = findHistoricalPrimeSignal(candles5m);
    if (!historical) return { name: "PRIME HISTORY", result: "NOT_AVAILABLE", detail: "No confirmed Pine V7 signal in available 5-min history" };

    // Keep the API resilient: never let a malformed historical timestamp break the complete 210-stock scan.
    let time = historical.signalTimestamp;
    try {
      const d = new Date(historical.signalTimestamp);
      if (!Number.isNaN(d.getTime())) {
        time = d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
      }
    } catch {
      // Keep the original Upstox timestamp.
    }

    return {
      name: "PRIME HISTORY",
      result: "PASS",
      detail: `✓ ${historical.direction} ${historical.setup} | Trigger ₹${historical.triggerPrice} | ${historical.level} | Vol ${historical.volumeRatio.toFixed(1)}× | EMA ₹${historical.ema20} ${historical.emaTrend === "RISING" ? "↗" : "↘"} | SL ₹${historical.sl} | ${time} IST`,
    };
  } catch (error) {
    console.warn("[prime] historical replay skipped", error instanceof Error ? error.message : String(error));
    return { name: "PRIME HISTORY", result: "NOT_AVAILABLE", detail: "Historical replay unavailable for this symbol; current scan preserved" };
  }
}

export function scanInstrument(input: ScanInput): PrimeScanRow {
  const { symbol, name, instrumentKey, futuresInstrumentKey, lotSize, isin, ltp, dayChangePct, open, prevClose, prevHigh, prevLow, candles5m } = input;
  const updatedAt = new Date().toISOString();
  const dataFresh = candles5m.length > 0;
  const hasLevels = prevHigh !== null && prevLow !== null && prevHigh > 0 && prevLow > 0;
  const levels: PrimeLevels | null = hasLevels ? buildPrimeLevels(prevHigh!, prevLow!) : null;
  const rawCandle = getLatestCandle(candles5m);
  const candle: CandleData | null = rawCandle ? analyseCandle(rawCandle) : null;
  const volume: VolumeAnalysis | null = candle && candles5m.length > 1 ? analyseVolume(candle.volume, candles5m.map(c => c.volume), candle.timestamp) : null;
  const closes = candles5m.map(c => c.close);
  const ema: EMAAnalysis | null = closes.length >= 2 && ltp !== null ? analyseEMA(closes, ltp) : null;
  const reaction = levels && candle && ltp !== null ? analyseReaction(candle, levels, ltp) : {
    levelTouched: null,
    reactionType: "NO_INTERACTION" as const,
    direction: "NEUTRAL" as const,
    structuralSL: null,
    confirmationStatus: "NOT_AVAILABLE" as const,
    detail: hasLevels ? "No candle data available for reaction analysis." : "YH/YL levels not available.",
  };

  let fakeBreakout = false;
  if (levels && candles5m.length >= 2) {
    const candleHistory = candles5m.map(c => analyseCandle(c));
    fakeBreakout = detectFakeBreakout(candleHistory, levels.yh, "UP").detected || detectFakeBreakout(candleHistory, levels.yl, "DOWN").detected;
  }

  const location = levels && ltp !== null ? determinePriceLocation(ltp, levels) : "INSUFFICIENT_DATA";
  const state = determineState(hasLevels, reaction, candle, volume, ema, fakeBreakout, ltp);
  const direction = reaction.direction;
  const pipeline = buildPipeline(hasLevels, reaction, candle, volume, ema);
  pipeline.push(safeHistoricalDetail(candles5m));
  const { score, note: scoreNote } = calculateScore(state, direction, volume, ema, candle, location);
  const reason = buildReason(reaction, volume, ema, state);
  const sl = reaction.structuralSL;
  const entry: number | null = null;
  const riskPerShare = entry !== null && sl !== null ? parseFloat(Math.abs(entry - sl).toFixed(2)) : null;
  const qty: number | null = null;

  return {
    symbol, name, instrumentKey, futuresInstrumentKey, lotSize, isin,
    ltp, dayChangePct, open, prevClose,
    yh: levels?.yh ?? null, yl: levels?.yl ?? null,
    mid: null, r1: null, r2: null, r3: null, s1: null, s2: null, s3: null,
    levelsVerificationNote: "PENDING_RULE_VERIFICATION",
    location, reaction, candle, volume, ema, state, direction, pipeline,
    entry, sl, riskPerShare, qty, score, scoreNote, rank: 0, reason, updatedAt, dataFresh,
  };
}

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
