"use client";

import type { CandleData } from "./types";

interface CandlePanelProps {
  candle: CandleData | null;
}

export default function CandlePanel({ candle }: CandlePanelProps) {
  if (!candle) {
    return (
      <div
        style={{
          background: "rgba(74,88,120,0.1)",
          border: "1px solid #1e2a42",
          borderRadius: "6px",
          padding: "16px",
          textAlign: "center",
          color: "#4a5878",
          fontSize: "0.78rem",
        }}
      >
        No candle data available
      </div>
    );
  }

  const isBullish = candle.type === "BULLISH";
  const isBearish = candle.type === "BEARISH";
  const candleColor = isBullish ? "#00d084" : isBearish ? "#ff4757" : "#8496b8";

  const rows: { label: string; value: string; color?: string }[] = [
    { label: "OPEN", value: `₹${candle.open.toFixed(2)}` },
    { label: "HIGH", value: `₹${candle.high.toFixed(2)}`, color: "#00d084" },
    { label: "LOW", value: `₹${candle.low.toFixed(2)}`, color: "#ff4757" },
    { label: "CLOSE", value: `₹${candle.close.toFixed(2)}`, color: candleColor },
    { label: "RANGE", value: `₹${candle.range.toFixed(2)}` },
    { label: "BODY", value: `₹${candle.body.toFixed(2)}` },
    { label: "UPPER WICK", value: `₹${candle.upperWick.toFixed(2)}` },
    { label: "LOWER WICK", value: `₹${candle.lowerWick.toFixed(2)}` },
    { label: "BODY %", value: `${candle.bodyPercent.toFixed(1)}%` },
    { label: "CLOSE LOCATION", value: candle.closeLocation },
    { label: "VOLUME", value: candle.volume.toLocaleString("en-IN") },
  ];

  const ts = new Date(candle.timestamp);
  const timeStr = isNaN(ts.getTime())
    ? candle.timestamp
    : ts.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

  return (
    <div
      style={{
        background: "#131929",
        border: `1px solid ${candleColor}30`,
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: `${candleColor}10`,
          borderBottom: `1px solid ${candleColor}20`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Visual candle */}
          <div
            style={{
              width: "12px",
              height: "24px",
              background: candleColor,
              borderRadius: "2px",
              opacity: 0.8,
            }}
          />
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: candleColor, letterSpacing: "0.06em" }}>
            5-MIN CANDLE
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: "3px",
              background: `${candleColor}20`,
              color: candleColor,
              border: `1px solid ${candleColor}40`,
            }}
          >
            {candle.type}
          </span>
          <span style={{ fontSize: "0.68rem", color: "#8496b8" }}>{timeStr} IST</span>
        </div>
      </div>

      {/* Data grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0",
        }}
      >
        {rows.map((row, idx) => (
          <div
            key={row.label}
            style={{
              padding: "7px 14px",
              borderBottom: "1px solid #1e2a42",
              borderRight: idx % 2 === 0 ? "1px solid #1e2a42" : "none",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {row.label}
            </div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: row.color || "#e2e8f4", marginTop: "2px" }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
