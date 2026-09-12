/**
 * Client-safe types for dashboard components.
 * These mirror the server domain types but are safe to pass to React components.
 */

export type { PrimeScanRow, PrimeScanResponse, PrimeScanState, PrimeDirection, PrimePipelineStage, StageResult, VolumeAnalysis, CandleData, EMAAnalysis, ReactionAnalysis, MarketStatus } from "@/domain/prime";

export interface StatusInfo {
  upstox: {
    connected: boolean;
    expired: boolean;
    expiresAt: string | null;
    refreshedAt: string | null;
  };
  market: {
    status: "PRE_MARKET" | "OPEN" | "CLOSED" | "HOLIDAY";
    label: string;
    currentIST: string;
    openTime: string;
    closeTime: string;
  };
  serverTime: string;
}

export interface RiskCalcInputs {
  accountCapital: number;
  riskPct: number;
}
