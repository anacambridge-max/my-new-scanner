"use client";

import type { PrimeScanRow, PrimeScanState } from "./types";

interface SummaryCardsProps {
  rows: PrimeScanRow[];
  universeCount: number;
  isLoading: boolean;
}

interface CardDef {
  label: string;
  key: "universe" | "buy" | "sell" | PrimeScanState;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

const CARDS: CardDef[] = [
  { label: "F&O UNIVERSE", key: "universe", color: "#8496b8", bg: "rgba(132,150,184,0.08)", border: "rgba(132,150,184,0.2)", icon: "⊞" },
  { label: "PRIME BUY", key: "buy", color: "#00d084", bg: "rgba(0,208,132,0.08)", border: "rgba(0,208,132,0.2)", icon: "⬆" },
  { label: "PRIME SELL", key: "sell", color: "#ff4757", bg: "rgba(255,71,87,0.08)", border: "rgba(255,71,87,0.2)", icon: "⬇" },
  { label: "SETUPS", key: "SETUP", color: "#3d8bff", bg: "rgba(61,139,255,0.08)", border: "rgba(61,139,255,0.2)", icon: "◈" },
  { label: "CONFIRMED", key: "CONFIRMED", color: "#00d084", bg: "rgba(0,208,132,0.12)", border: "rgba(0,208,132,0.3)", icon: "✓" },
  { label: "WATCH", key: "WATCH", color: "#ffa502", bg: "rgba(255,165,2,0.08)", border: "rgba(255,165,2,0.2)", icon: "◉" },
  { label: "FAKE BKT", key: "FAKE_BREAKOUT", color: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)", icon: "⚡" },
  { label: "NO TRADE", key: "NO_TRADE", color: "#4a5878", bg: "rgba(74,88,120,0.08)", border: "rgba(74,88,120,0.2)", icon: "✗" },
];

export default function SummaryCards({ rows, universeCount, isLoading }: SummaryCardsProps) {
  const counts = {
    universe: universeCount,
    buy: rows.filter((r) => r.direction === "BUY").length,
    sell: rows.filter((r) => r.direction === "SELL").length,
    WATCH: rows.filter((r) => r.state === "WATCH").length,
    SETUP: rows.filter((r) => r.state === "SETUP").length,
    CONFIRMED: rows.filter((r) => r.state === "CONFIRMED").length,
    FAKE_BREAKOUT: rows.filter((r) => r.state === "FAKE_BREAKOUT").length,
    INVALID: rows.filter((r) => r.state === "INVALID").length,
    NO_TRADE: rows.filter((r) => r.state === "NO_TRADE").length,
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: "8px",
        padding: "12px 16px",
        borderBottom: "1px solid #1e2a42",
      }}
    >
      {CARDS.map((card) => {
        const value = counts[card.key as keyof typeof counts] ?? 0;
        return (
          <div
            key={card.label}
            style={{
              padding: "12px 10px",
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: "6px",
              textAlign: "center",
            }}
          >
            {isLoading ? (
              <div
                className="skeleton"
                style={{ height: "28px", width: "40px", margin: "0 auto 4px" }}
              />
            ) : (
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: card.color,
                  lineHeight: 1,
                  marginBottom: "4px",
                }}
              >
                {value}
              </div>
            )}
            <div
              style={{
                fontSize: "0.58rem",
                color: card.color,
                opacity: 0.7,
                letterSpacing: "0.08em",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {card.icon} {card.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
