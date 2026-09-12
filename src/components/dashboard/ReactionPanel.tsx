"use client";

import type { ReactionAnalysis } from "./types";

interface ReactionPanelProps {
  reaction: ReactionAnalysis;
  isFakeBreakout?: boolean;
}

export default function ReactionPanel({ reaction, isFakeBreakout = false }: ReactionPanelProps) {
  const directionColor =
    reaction.direction === "BUY"
      ? "#00d084"
      : reaction.direction === "SELL"
      ? "#ff4757"
      : "#8496b8";

  const reactionColor =
    reaction.reactionType === "BULLISH_REACTION"
      ? "#00d084"
      : reaction.reactionType === "BEARISH_REACTION"
      ? "#ff4757"
      : "#8496b8";

  return (
    <div
      style={{
        background: "#131929",
        border: "1px solid #1e2a42",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #1e2a42",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#8496b8",
            letterSpacing: "0.08em",
          }}
        >
          REACTION ANALYSIS
        </span>
        <span
          style={{
            fontSize: "0.6rem",
            color: "#ffa502",
            fontStyle: "italic",
          }}
        >
          "Trade the reaction. Not the line."
        </span>
      </div>

      {/* Pipeline visual */}
      <div style={{ padding: "14px" }}>
        {/* Fake Breakout Banner */}
        {isFakeBreakout && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(168,85,247,0.12)",
              border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: "5px",
              marginBottom: "12px",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#a855f7",
              letterSpacing: "0.06em",
            }}
          >
            ⚡ POTENTIAL FAKE BREAKOUT DETECTED
          </div>
        )}

        {/* Sequence */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {/* Level Touched */}
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(61,139,255,0.08)",
              border: "1px solid rgba(61,139,255,0.2)",
              borderRadius: "5px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>LEVEL TOUCHED</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#3d8bff", marginTop: "2px" }}>
              {reaction.levelTouched || "—"}
            </div>
          </div>

          <div style={{ textAlign: "center", color: "#2e3d5a", fontSize: "1rem" }}>↓</div>

          {/* Reaction Type */}
          <div
            style={{
              padding: "8px 12px",
              background: `${reactionColor}10`,
              border: `1px solid ${reactionColor}30`,
              borderRadius: "5px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>REACTION</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: reactionColor, marginTop: "2px" }}>
              {reaction.reactionType.replace(/_/g, " ")}
            </div>
          </div>

          <div style={{ textAlign: "center", color: "#2e3d5a", fontSize: "1rem" }}>↓</div>

          {/* Direction */}
          <div
            style={{
              padding: "8px 12px",
              background: `${directionColor}10`,
              border: `1px solid ${directionColor}30`,
              borderRadius: "5px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>DIRECTION</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: directionColor, marginTop: "2px" }}>
              {reaction.direction === "BUY" ? "⬆ LONG SETUP" : reaction.direction === "SELL" ? "⬇ SHORT SETUP" : "— NEUTRAL"}
            </div>
          </div>

          <div style={{ textAlign: "center", color: "#2e3d5a", fontSize: "1rem" }}>↓</div>

          {/* Structural SL */}
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(74,88,120,0.1)",
              border: "1px solid rgba(74,88,120,0.3)",
              borderRadius: "5px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>STRUCTURAL SL</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#8496b8", marginTop: "2px" }}>
              {reaction.structuralSL !== null ? `₹${reaction.structuralSL.toFixed(2)}` : "Awaiting reaction"}
            </div>
          </div>

          <div style={{ textAlign: "center", color: "#2e3d5a", fontSize: "1rem" }}>↓</div>

          {/* Confirmation */}
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(255,165,2,0.08)",
              border: "1px solid rgba(255,165,2,0.3)",
              borderRadius: "5px",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>CONFIRMATION</div>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#ffa502", marginTop: "2px" }}>
              {reaction.confirmationStatus === "NOT_VERIFIED"
                ? "⚠ RULE NOT VERIFIED — Prime Technical manual"
                : reaction.confirmationStatus === "WAIT"
                ? "◐ WAITING"
                : reaction.confirmationStatus === "CONFIRMED"
                ? "✓ CONFIRMED"
                : "— NOT AVAILABLE"}
            </div>
          </div>
        </div>

        {/* Detail */}
        {reaction.detail && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              background: "rgba(74,88,120,0.08)",
              border: "1px solid #1e2a42",
              borderRadius: "5px",
              fontSize: "0.72rem",
              color: "#8496b8",
              lineHeight: "1.5",
            }}
          >
            {reaction.detail}
          </div>
        )}
      </div>
    </div>
  );
}
