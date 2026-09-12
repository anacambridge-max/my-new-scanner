/**
 * PRIME TECHNICAL MASTER – Scanner Engine
 *
 * Confirmation is aligned to the user's PRIME TECHNICAL MASTER — L1-L12 Pine.
 * Historical replay uses the same confirmation rules in historical.ts.
 */
import type { PrimeScanRow, PrimeScanState, PrimeDirection, PrimePipelineStage, StageResult, ReactionAnalysis, EMAAnalysis, VolumeAnalysis, CandleData, PrimeLevels } from "@/domain/prime";
import { buildPrimeLevels, determinePriceLocation } from "./levels";
import { analyseCandle, getLatestCandle, type RawCandle } from "./candle";
import { analyseVolume } from "./volume";
import { analyseEMA } from "./ema";
import { analyseReaction, detectFakeBreakout } from "./reaction";
import { findHistoricalPrimeSignal } from "./historical";

export interface ScanInput { symbol: string; name: string; instrumentKey: string; futuresInstrumentKey: string | null; lotSize: number; isin: string; ltp: number | null; dayChangePct: number | null; open: number | null; prevClose: number | null; prevHigh: number | null; prevLow: number | null; candles5m: RawCandle[]; }

const MIN_VOLUME_MULTIPLE = 1.5;
const MIN_BODY_RATIO = 0.50;
const MIN_CLOSE_LOCATION = 0.60;

type PineConfirmation = { direction: PrimeDirection; confirmed: boolean; setup: "BREAKOUT" | "BREAKDOWN" | null };

function istParts(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}
function inScanWindow(timestamp: string) { const p = istParts(timestamp); const m = p.hour * 60 + p.minute; return m >= 555 && m < 600; }

function pineConfirmation(candles: RawCandle[], yh: number, yl: number, ema20: number | null): PineConfirmation {
  if (candles.length < 2 || ema20 === null) return { direction: "NEUTRAL", confirmed: false, setup: null };
  const c = candles[candles.length - 1], prev = candles[candles.length - 2];
  if (!inScanWindow(c.timestamp)) return { direction: "NEUTRAL", confirmed: false, setup: null };
  const range = c.high - c.low;
  if (range <= 0) return { direction: "NEUTRAL", confirmed: false, setup: null };
  const bodyRatio = Math.abs(c.close - c.open) / range;
  const bullReaction = c.close > c.open && bodyRatio >= MIN_BODY_RATIO && (c.close - c.low) / range >= MIN_CLOSE_LOCATION;
  const bearReaction = c.close < c.open && bodyRatio >= MIN_BODY_RATIO && (c.high - c.close) / range >= MIN_CLOSE_LOCATION;
  if (candles.length < 20) return { direction: "NEUTRAL", confirmed: false, setup: null };
  // Pine ta.sma(volume, 20) includes the current candle.
  const volumeWindow = candles.slice(-20);
  const avgVol = volumeWindow.reduce((sum, x) => sum + x.volume, 0) / volumeWindow.length;
  const volumePass = avgVol > 0 && c.volume / avgVol >= MIN_VOLUME_MULTIPLE;
  const bullBreak = c.close > yh && prev.close <= yh;
  const bearBreak = c.close < yl && prev.close >= yl;
  const bull = bullBreak && bullReaction && volumePass && c.close > ema20;
  const bear = bearBreak && bearReaction && volumePass && c.close < ema20;
  return { direction: bull ? "BUY" : bear ? "SELL" : "NEUTRAL", confirmed: bull || bear, setup: bull ? "BREAKOUT" : bear ? "BREAKDOWN" : null };
}

function determineState(hasLevels: boolean, reaction: ReactionAnalysis, candle: CandleData | null, volume: VolumeAnalysis | null, ema: EMAAnalysis | null, fakeBreakout: boolean, ltp: number | null, pineConfirmed: boolean): PrimeScanState {
  if (!ltp || !hasLevels) return "INVALID";
  if (fakeBreakout) return "FAKE_BREAKOUT";
  if (pineConfirmed) return "CONFIRMED";
  if (!candle) return "WATCH";
  const hasReaction = reaction.reactionType === "BULLISH_REACTION" || reaction.reactionType === "BEARISH_REACTION";
  if (!hasReaction) return "WATCH";
  const volumeParticipating = !!volume && volume.ratio >= MIN_VOLUME_MULTIPLE;
  const emaAligned = !!ema && ((reaction.direction === "BUY" && ema.position === "ABOVE") || (reaction.direction === "SELL" && ema.position === "BELOW"));
  return volumeParticipating && emaAligned ? "SETUP" : "WATCH";
}

function buildPipeline(hasLevels: boolean, reaction: ReactionAnalysis, candle: CandleData | null, volume: VolumeAnalysis | null, ema: EMAAnalysis | null, pineConfirmed: boolean): PrimePipelineStage[] {
  const hasReaction = reaction.reactionType === "BULLISH_REACTION" || reaction.reactionType === "BEARISH_REACTION";
  const stageResult = (pass: boolean | null | undefined, fallback: StageResult = "NOT_AVAILABLE"): StageResult => pass === null || pass === undefined ? fallback : pass ? "PASS" : "WAIT";
  return [
    { name: "LEVEL", result: hasLevels ? "PASS" : "NOT_AVAILABLE", detail: hasLevels ? "YH/YL verified" : "No level data" },
    { name: "REACTION", result: hasReaction ? "PASS" : reaction.reactionType === "NEUTRAL" ? "WAIT" : "NOT_AVAILABLE", detail: reaction.reactionType },
    { name: "CANDLE", result: candle ? stageResult(candle.bodyPercent >= 50) : "NOT_AVAILABLE", detail: candle ? `${candle.type} | Body ${candle.bodyPercent.toFixed(0)}%` : "No candle" },
    { name: "VOLUME", result: volume && volume.ratio >= MIN_VOLUME_MULTIPLE ? "PASS" : volume ? "WAIT" : "NOT_AVAILABLE", detail: volume ? `${volume.ratio.toFixed(1)}× avg` : "No volume" },
    { name: "20 EMA", result: ema && ema.ema20 !== null ? stageResult((reaction.direction === "BUY" && ema.position === "ABOVE") || (reaction.direction === "SELL" && ema.position === "BELOW"), "WAIT") : "NOT_AVAILABLE", detail: ema?.ema20 ? `EMA ₹${ema.ema20} | ${ema.position}` : "Insufficient data" },
    { name: "CONFIRMATION", result: pineConfirmed ? "PASS" : "WAIT", detail: pineConfirmed ? "Pine PRIME confirmation" : "Awaiting exact YH/YL confirmation" },
    { name: "SL", result: reaction.structuralSL !== null ? "PASS" : "WAIT", detail: reaction.structuralSL !== null ? `Structural SL ₹${reaction.structuralSL}` : "Awaiting reaction" },
    { name: "QTY", result: "NOT_AVAILABLE", detail: "Requires entry + SL confirmation" },
  ];
}

function calculateScore(state: PrimeScanState, direction: PrimeDirection, volume: VolumeAnalysis | null, ema: EMAAnalysis | null, candle: CandleData | null, location: string): { score: number; note: string } {
  let score = 0; const parts: string[] = [];
  if (state === "CONFIRMED") { score += 60; parts.push("CONFIRMED+60"); } else if (state === "SETUP") { score += 30; parts.push("SETUP+30"); } else if (state === "FAKE_BREAKOUT") { score += 20; parts.push("FAKE_BREAKOUT+20"); } else if (state === "WATCH") { score += 10; parts.push("WATCH+10"); }
  if (volume) { const vScore = Math.min(volume.ratio, 10) * 2; score += vScore; parts.push(`VOL+${vScore.toFixed(0)}`); }
  if (ema?.ema20 !== null && ema) { const aligned = (direction === "BUY" && ema.position === "ABOVE") || (direction === "SELL" && ema.position === "BELOW"); if (aligned) { score += 15; parts.push("EMA+15"); } }
  if (candle && ((direction === "BUY" && candle.closeLocation === "UPPER") || (direction === "SELL" && candle.closeLocation === "LOWER"))) { score += 10; parts.push("CLOSE_LOC+10"); }
  if (location === "NEAR_YH" || location === "NEAR_YL") { score += 15; parts.push("NEAR_LEVEL+15"); }
  return { score: Math.round(score), note: `Pine-aligned scanner ranking: ${parts.join(", ") || "base"}` };
}

function buildReason(reaction: ReactionAnalysis, volume: VolumeAnalysis | null, ema: EMAAnalysis | null, state: PrimeScanState): string {
  const parts: string[] = [reaction.detail];
  if (volume) parts.push(volume.isOpeningCandle ? "Opening candle volume treated separately." : `Volume ${volume.ratio.toFixed(1)}× avg.`);
  if (ema?.ema20) parts.push(`20 EMA ₹${ema.ema20} — price ${ema.position}.`);
  if (state === "CONFIRMED") parts.push("Exact Pine YH/YL breakout/breakdown confirmation passed."); else if (state === "SETUP") parts.push("Watch candidate. Await exact Pine confirmation."); else if (state === "WATCH") parts.push("Watch candidate. Await setup formation.");
  return parts.join(" ");
}

function safeHistoricalDetail(candles5m: RawCandle[]): PrimePipelineStage {
  try {
    const historical = findHistoricalPrimeSignal(candles5m);
    if (!historical) return { name: "PRIME HISTORY", result: "NOT_AVAILABLE", detail: "No confirmed Pine PRIME signal in available 5-min history" };
    let time = historical.signalTimestamp;
    try { const d = new Date(historical.signalTimestamp); if (!Number.isNaN(d.getTime())) time = d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }); } catch {}
    return { name: "PRIME HISTORY", result: "PASS", detail: `✓ ${historical.direction} ${historical.setup} | Trigger ₹${historical.triggerPrice} | ${historical.level} | Vol ${historical.volumeRatio.toFixed(1)}× | EMA ₹${historical.ema20} ${historical.emaTrend === "RISING" ? "↗" : historical.emaTrend === "FALLING" ? "↘" : "→"} | SL ₹${historical.sl} | ${time} IST` };
  } catch (error) { console.warn("[prime] historical replay skipped", error instanceof Error ? error.message : String(error)); return { name: "PRIME HISTORY", result: "NOT_AVAILABLE", detail: "Historical replay unavailable for this symbol" }; }
}

export function scanInstrument(input: ScanInput): PrimeScanRow {
  const { symbol, name, instrumentKey, futuresInstrumentKey, lotSize, isin, ltp, dayChangePct, open, prevClose, prevHigh, prevLow, candles5m } = input;
  const updatedAt = new Date().toISOString(); const dataFresh = candles5m.length > 0;
  const hasLevels = prevHigh !== null && prevLow !== null && prevHigh > 0 && prevLow > 0;
  const levels: PrimeLevels | null = hasLevels ? buildPrimeLevels(prevHigh!, prevLow!) : null;
  const rawCandle = getLatestCandle(candles5m);
  const candle: CandleData | null = rawCandle ? analyseCandle(rawCandle) : null;
  const volume: VolumeAnalysis | null = candle && candles5m.length > 1 ? analyseVolume(candle.volume, candles5m.map(c => c.volume), candle.timestamp) : null;
  const closes = candles5m.map(c => c.close); const ema: EMAAnalysis | null = closes.length >= 2 && ltp !== null ? analyseEMA(closes, ltp) : null;
  const reaction = levels && candle && ltp !== null ? analyseReaction(candle, levels, ltp) : { levelTouched: null, reactionType: "NO_INTERACTION" as const, direction: "NEUTRAL" as const, structuralSL: null, confirmationStatus: "NOT_AVAILABLE" as const, detail: hasLevels ? "No candle data available for reaction analysis." : "YH/YL levels not available." };
  let fakeBreakout = false;
  if (levels && candles5m.length >= 2) { const candleHistory = candles5m.map(c => analyseCandle(c)); fakeBreakout = detectFakeBreakout(candleHistory, levels.yh, "UP").detected || detectFakeBreakout(candleHistory, levels.yl, "DOWN").detected; }
  const location = levels && ltp !== null ? determinePriceLocation(ltp, levels) : "INSUFFICIENT_DATA";
  const pine: PineConfirmation = levels && candles5m.length >= 2 ? pineConfirmation(candles5m, levels.yh, levels.yl, ema?.ema20 ?? null) : { direction: "NEUTRAL", confirmed: false, setup: null };
  const state = determineState(hasLevels, reaction, candle, volume, ema, fakeBreakout, ltp, pine.confirmed);
  const direction: PrimeDirection = pine.confirmed ? pine.direction : reaction.direction;
  const pipeline = buildPipeline(hasLevels, reaction, candle, volume, ema, pine.confirmed); pipeline.push(safeHistoricalDetail(candles5m));
  const { score, note: scoreNote } = calculateScore(state, direction, volume, ema, candle, location);
  const reason = buildReason(reaction, volume, ema, state);
  const sl = pine.confirmed && candle ? (pine.direction === "BUY" ? candle.low : candle.high) : reaction.structuralSL;
  const entry: number | null = pine.confirmed && candle ? candle.close : null;
  const riskPerShare = entry !== null && sl !== null ? parseFloat(Math.abs(entry - sl).toFixed(2)) : null;
  const qty: number | null = null;
  return { symbol, name, instrumentKey, futuresInstrumentKey, lotSize, isin, ltp, dayChangePct, open, prevClose, yh: levels?.yh ?? null, yl: levels?.yl ?? null, mid: null, r1: null, r2: null, r3: null, s1: null, s2: null, s3: null, levelsVerificationNote: "PENDING_RULE_VERIFICATION", location, reaction, candle, volume, ema, state, direction, pipeline, entry, sl, riskPerShare, qty, score, scoreNote, rank: 0, reason, updatedAt, dataFresh };
}

function statePriority(state: PrimeScanState): number { switch (state) { case "CONFIRMED": return 6; case "SETUP": return 5; case "FAKE_BREAKOUT": return 4; case "WATCH": return 3; case "NO_TRADE": return 2; case "INVALID": return 1; default: return 0; } }
export function rankScanResults(rows: PrimeScanRow[]): PrimeScanRow[] { const sorted = [...rows].sort((a, b) => { const sp = statePriority(b.state) - statePriority(a.state); if (sp !== 0) return sp; return b.score - a.score; }); return sorted.map((row, idx) => ({ ...row, rank: idx + 1 })); }
