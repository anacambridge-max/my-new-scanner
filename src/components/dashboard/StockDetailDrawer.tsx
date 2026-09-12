"use client";

import type { PrimeScanRow } from "./types";
import StateBadge from "./StateBadge";
import PrimePipeline from "./PrimePipeline";
import LevelPanel from "./LevelPanel";
import CandlePanel from "./CandlePanel";
import VolumeDisplay from "./VolumeDisplay";
import ReactionPanel from "./ReactionPanel";
import RiskCalculator from "./RiskCalculator";

interface StockDetailDrawerProps {
  row: PrimeScanRow;
  onClose: () => void;
}

export default function StockDetailDrawer({ row, onClose }: StockDetailDrawerProps) {
  const directionColor =
    row.direction === "BUY"
      ? "#00d084"
      : row.direction === "SELL"
      ? "#ff4757"
      : "#8496b8";

  const dayPctColor =
    row.dayChangePct !== null && row.dayChangePct > 0
      ? "#00d084"
      : row.dayChangePct !== null && row.dayChangePct < 0
      ? "#ff4757"
      : "#8496b8";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "480px",
        height: "100vh",
        background: "#0f1525",
        borderLeft: "1px solid #1e2a42",
        zIndex: 1000,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "#0c1120",
          borderBottom: "1px solid #1e2a42",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f4" }}>
              {row.symbol}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#8496b8", marginTop: "1px" }}>
              {row.name}
            </div>
          </div>
          <StateBadge state={row.state} />
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,71,87,0.1)",
            border: "1px solid rgba(255,71,87,0.3)",
            borderRadius: "4px",
            color: "#ff4757",
            padding: "5px 10px",
            cursor: "pointer",
            fontSize: "0.78rem",
            fontFamily: "inherit",
          }}
        >
          ✕ CLOSE
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Key Metrics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              background: "#131929",
              border: "1px solid #1e2a42",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>LTP</div>
            <div style={{ fontSize: "1.0rem", fontWeight: 700, color: "#3d8bff", marginTop: "2px" }}>
              {row.ltp !== null ? `₹${row.ltp.toFixed(2)}` : "—"}
            </div>
          </div>
          <div
            style={{
              padding: "10px 12px",
              background: "#131929",
              border: "1px solid #1e2a42",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>DAY %</div>
            <div style={{ fontSize: "1.0rem", fontWeight: 700, color: dayPctColor, marginTop: "2px" }}>
              {row.dayChangePct !== null
                ? `${row.dayChangePct > 0 ? "+" : ""}${row.dayChangePct.toFixed(2)}%`
                : "—"}
            </div>
          </div>
          <div
            style={{
              padding: "10px 12px",
              background: "#131929",
              border: "1px solid #1e2a42",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>DIRECTION</div>
            <div style={{ fontSize: "1.0rem", fontWeight: 700, color: directionColor, marginTop: "2px" }}>
              {row.direction === "BUY" ? "⬆ BUY" : row.direction === "SELL" ? "⬇ SELL" : "—"}
            </div>
          </div>
        </div>

        {/* F&O Info */}
        <div
          style={{
            padding: "10px 14px",
            background: "#131929",
            border: "1px solid #1e2a42",
            borderRadius: "6px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>LOT SIZE</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f4", marginTop: "2px" }}>
              {row.lotSize}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>SCORE (RANK)</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#ffa502", marginTop: "2px" }}>
              {row.score} #{row.rank}
            </div>
          </div>
        </div>

        {/* Prime Pipeline */}
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#8496b8",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            PRIME PIPELINE
          </div>
          <PrimePipeline pipeline={row.pipeline} />
        </div>

        {/* Level Panel */}
        <LevelPanel ltp={row.ltp} yh={row.yh} yl={row.yl} />

        {/* Latest 5-min Candle */}
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#8496b8",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            LATEST 5-MINUTE CANDLE
          </div>
          <CandlePanel candle={row.candle} />
        </div>

        {/* Volume */}
        <div
          style={{
            padding: "12px 14px",
            background: "#131929",
            border: "1px solid #1e2a42",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#8496b8", letterSpacing: "0.08em", marginBottom: "8px" }}>
            VOLUME ANALYSIS
          </div>
          <VolumeDisplay volume={row.volume} />
          {row.volume?.isOpeningCandle && (
            <div
              style={{
                marginTop: "8px",
                padding: "6px 10px",
                background: "rgba(255,165,2,0.08)",
                border: "1px solid rgba(255,165,2,0.2)",
                borderRadius: "4px",
                fontSize: "0.68rem",
                color: "#ffa502",
              }}
            >
              ⚠ Opening candle (09:15–09:20). Volume must not be compared directly to intraday candles.
            </div>
          )}
        </div>

        {/* 20 EMA */}
        {row.ema && (
          <div
            style={{
              padding: "12px 14px",
              background: "#131929",
              border: "1px solid #1e2a42",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#8496b8", letterSpacing: "0.08em", marginBottom: "8px" }}>
              20 EMA (5-MINUTE)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <div style={{ fontSize: "0.6rem", color: "#4a5878" }}>EMA VALUE</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f4", marginTop: "2px" }}>
                  {row.ema.ema20 !== null ? `₹${row.ema.ema20}` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.6rem", color: "#4a5878" }}>POSITION</div>
                <div
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color:
                      row.ema.position === "ABOVE"
                        ? "#00d084"
                        : row.ema.position === "BELOW"
                        ? "#ff4757"
                        : "#ffa502",
                    marginTop: "2px",
                  }}
                >
                  {row.ema.position}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.6rem", color: "#4a5878" }}>DISTANCE</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#8496b8", marginTop: "2px" }}>
                  {row.ema.distancePct !== null ? `${row.ema.distancePct > 0 ? "+" : ""}${row.ema.distancePct.toFixed(2)}%` : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reaction */}
        <ReactionPanel
          reaction={row.reaction}
          isFakeBreakout={row.state === "FAKE_BREAKOUT"}
        />

        {/* Risk Calculator */}
        <RiskCalculator row={row} />

        {/* Reason */}
        <div
          style={{
            padding: "12px 14px",
            background: "#131929",
            border: "1px solid #1e2a42",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#8496b8", letterSpacing: "0.08em", marginBottom: "6px" }}>
            REASON / AUDIT TRAIL
          </div>
          <div style={{ fontSize: "0.72rem", color: "#8496b8", lineHeight: "1.6" }}>
            {row.reason}
          </div>
        </div>

        {/* Score note */}
        <div
          style={{
            padding: "8px 14px",
            background: "rgba(74,88,120,0.08)",
            border: "1px solid #1e2a42",
            borderRadius: "5px",
            fontSize: "0.62rem",
            color: "#4a5878",
            lineHeight: "1.5",
          }}
        >
          {row.scoreNote}
        </div>

        {/* Data freshness */}
        <div style={{ fontSize: "0.62rem", color: "#2e3d5a", textAlign: "center", paddingBottom: "8px" }}>
          Updated: {new Date(row.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          {" | "}Data: {row.dataFresh ? "✓ Fresh" : "⚠ Stale"}
        </div>
      </div>
    </div>
  );
}
