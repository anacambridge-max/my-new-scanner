"use client";

import type { PrimeScanState } from "./types";

interface StateBadgeProps {
  state: PrimeScanState;
  size?: "sm" | "md";
}

const STATE_CONFIG: Record<PrimeScanState, { label: string; bg: string; text: string; border: string }> = {
  WATCH: {
    label: "WATCH",
    bg: "rgba(255,165,2,0.12)",
    text: "#ffa502",
    border: "rgba(255,165,2,0.4)",
  },
  SETUP: {
    label: "SETUP",
    bg: "rgba(61,139,255,0.12)",
    text: "#3d8bff",
    border: "rgba(61,139,255,0.4)",
  },
  CONFIRMED: {
    label: "CONFIRMED",
    bg: "rgba(0,208,132,0.12)",
    text: "#00d084",
    border: "rgba(0,208,132,0.4)",
  },
  FAKE_BREAKOUT: {
    label: "FAKE BKT",
    bg: "rgba(168,85,247,0.12)",
    text: "#a855f7",
    border: "rgba(168,85,247,0.4)",
  },
  INVALID: {
    label: "INVALID",
    bg: "rgba(255,71,87,0.10)",
    text: "#ff4757",
    border: "rgba(255,71,87,0.3)",
  },
  NO_TRADE: {
    label: "NO TRADE",
    bg: "rgba(74,88,120,0.15)",
    text: "#8496b8",
    border: "rgba(74,88,120,0.4)",
  },
};

export default function StateBadge({ state, size = "md" }: StateBadgeProps) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.NO_TRADE;
  const padding = size === "sm" ? "2px 6px" : "3px 9px";
  const fontSize = size === "sm" ? "0.62rem" : "0.68rem";

  return (
    <span
      style={{
        display: "inline-block",
        padding,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.08em",
        borderRadius: "3px",
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}
