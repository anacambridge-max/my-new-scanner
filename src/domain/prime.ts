/**
 * PRIME TECHNICAL MASTER – Core Domain Types
 *
 * Source of truth: Prime Technical course/manual.
 * Rules not explicitly verified from the manual are marked NOT_VERIFIED.
 */

// ─── Scanner State ──────────────────────────────────────────────────────────

export type PrimeScanState =
  | "WATCH"
  | "SETUP"
  | "CONFIRMED"
  | "FAKE_BREAKOUT"
  | "INVALID"
  | "NO_TRADE";

// ─── Direction ──────────────────────────────────────────────────────────────

export type PrimeDirection = "BUY" | "SELL" | "NEUTRAL";

// ─── Pipeline Stage Result ───────────────────────────────────────────────────

export type StageResult = "PASS" | "WAIT" | "FAIL" | "NOT_AVAILABLE";

export interface PrimePipelineStage {
  name: string;
  result: StageResult;
  detail?: string;
}

// ─── Volume Classification ───────────────────────────────────────────────────
// Source: Prime Technical AFL – 20-period average volume
// 2× avg = STAR_1, 4× avg = STAR_2, 6.5× avg = STAR_3

export type VolumeRating = "NORMAL" | "STAR_1" | "STAR_2" | "STAR_3";

export interface VolumeAnalysis {
  current: number;
  avgPeriod: number; // always 20 per manual
  avg20: number;
  ratio: number;
  rating: VolumeRating;
  isOpeningCandle: boolean; // 09:15–09:20 treated separately
}

// ─── Candle Analysis ─────────────────────────────────────────────────────────

export type CandleType = "BULLISH" | "BEARISH" | "NEUTRAL" | "DOJI";
export type CloseLocation = "UPPER" | "MIDDLE" | "LOWER" | "UNKNOWN";

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // derived
  range: number;
  body: number;
  upperWick: number;
  lowerWick: number;
  bodyPercent: number;
  closeLocation: CloseLocation;
  type: CandleType;
}

// ─── Level Analysis ──────────────────────────────────────────────────────────
// NOTE: YH and YL are verified.
// MID / R1–R3 / S1–S3 exact formulas are NOT verified from the manual.

export type LevelVerificationStatus = "VERIFIED" | "RULE_NOT_VERIFIED";

export interface PrimeLevels {
  yh: number; // Yesterday High – VERIFIED
  yl: number; // Yesterday Low – VERIFIED
  midVerified: false; // MID formula NOT verified
  r1Verified: false; // R1 formula NOT verified
  r2Verified: false; // R2 formula NOT verified
  r3Verified: false; // R3 formula NOT verified
  s1Verified: false; // S1 formula NOT verified
  s2Verified: false; // S2 formula NOT verified
  s3Verified: false; // S3 formula NOT verified
}

export interface LevelProximity {
  level: string;
  value: number;
  distance: number; // absolute ₹ distance from LTP
  distancePct: number; // % distance from LTP
  side: "ABOVE" | "BELOW" | "AT";
  verified: boolean;
}

// ─── Reaction Analysis ───────────────────────────────────────────────────────
// "Do not trade the line. Trade the reaction to the line."

export type ReactionType =
  | "BULLISH_REACTION"
  | "BEARISH_REACTION"
  | "NEUTRAL"
  | "NO_INTERACTION"
  | "NOT_AVAILABLE";

export interface ReactionAnalysis {
  levelTouched: string | null;
  reactionType: ReactionType;
  direction: PrimeDirection;
  structuralSL: number | null;
  confirmationStatus: "WAIT" | "NOT_VERIFIED" | "CONFIRMED" | "NOT_AVAILABLE";
  detail: string;
}

// ─── EMA Analysis ────────────────────────────────────────────────────────────

export type EMAPosition = "ABOVE" | "BELOW" | "AT" | "NOT_AVAILABLE";

export interface EMAAnalysis {
  ema20: number | null;
  ltp: number;
  position: EMAPosition;
  distance: number | null;
  distancePct: number | null;
}

// ─── Risk Calculation ────────────────────────────────────────────────────────

export interface RiskCalculation {
  accountCapital: number | null;
  riskPct: number | null;
  riskBudget: number | null;
  entry: number | null;
  structuralSL: number | null;
  riskPerShare: number | null;
  lotSize: number;
  calculatedQty: number | null;
  status: "READY" | "WAITING_FOR_ENTRY_SL" | "MISSING_DATA";
}

// ─── Prime Scanner Row ────────────────────────────────────────────────────────

export interface PrimeScanRow {
  // Identity
  symbol: string;
  name: string;
  instrumentKey: string; // equity instrument key
  futuresInstrumentKey: string | null;
  lotSize: number;
  isin: string;

  // Market Data
  ltp: number | null;
  dayChangePct: number | null;
  open: number | null;
  prevClose: number | null;

  // Levels (verified)
  yh: number | null;
  yl: number | null;

  // Levels (NOT verified – formula pending)
  mid: null;
  r1: null;
  r2: null;
  r3: null;
  s1: null;
  s2: null;
  s3: null;
  levelsVerificationNote: "PENDING_RULE_VERIFICATION";

  // Analysis
  location: string; // e.g. "NEAR_YH", "NEAR_YL", "MID_RANGE"
  reaction: ReactionAnalysis;
  candle: CandleData | null;
  volume: VolumeAnalysis | null;
  ema: EMAAnalysis | null;

  // Prime State
  state: PrimeScanState;
  direction: PrimeDirection;
  pipeline: PrimePipelineStage[];

  // Risk (entry/SL must come from engine, not frontend guess)
  entry: number | null;
  sl: number | null;
  riskPerShare: number | null;
  qty: number | null;

  // Score / Ranking
  score: number; // objective ranking score – documented formula below
  scoreNote: string;
  rank: number;

  // Reason (human-readable audit trail)
  reason: string;

  // Meta
  updatedAt: string;
  dataFresh: boolean;
}

// ─── Scanner Response ─────────────────────────────────────────────────────────

export interface PrimeScanResponse {
  universeCount: number;
  scanCount: number;
  generatedAt: string;
  marketStatus: "PRE_MARKET" | "OPEN" | "CLOSED" | "HOLIDAY";
  upstoxConnected: boolean;
  rows: PrimeScanRow[];
  error?: string;
}

// ─── Market Status ────────────────────────────────────────────────────────────

export interface MarketStatus {
  status: "PRE_MARKET" | "OPEN" | "CLOSED" | "HOLIDAY";
  label: string;
  currentIST: string;
  openTime: string;
  closeTime: string;
}
