"use client";

import { useState } from "react";
import type { PrimeScanRow } from "./types";

interface RiskCalculatorProps {
  row: PrimeScanRow;
}

export default function RiskCalculator({ row }: RiskCalculatorProps) {
  const [capital, setCapital] = useState<string>("500000");
  const [riskPct, setRiskPct] = useState<string>("1");

  const capitalNum = parseFloat(capital) || 0;
  const riskPctNum = parseFloat(riskPct) || 0;

  const riskBudget = capitalNum * (riskPctNum / 100);
  const entry = row.entry;
  const sl = row.sl;
  const lotSize = row.lotSize;

  const riskPerShare =
    entry !== null && sl !== null
      ? Math.abs(entry - sl)
      : null;

  const rawQty =
    riskPerShare !== null && riskPerShare > 0
      ? Math.floor(riskBudget / riskPerShare)
      : null;

  // Round to lot size for F&O
  const lots =
    rawQty !== null && lotSize > 0
      ? Math.floor(rawQty / lotSize)
      : null;
  const qty = lots !== null ? lots * lotSize : null;

  const inputStyle = {
    background: "#0a0e1a",
    border: "1px solid #1e2a42",
    borderRadius: "4px",
    color: "#e2e8f4",
    fontSize: "0.82rem",
    padding: "6px 10px",
    fontFamily: "inherit",
    width: "100%",
    outline: "none",
  };

  const labelStyle = {
    fontSize: "0.6rem",
    color: "#4a5878",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    display: "block",
    marginBottom: "4px",
  };

  const fieldStyle = {
    padding: "8px 12px",
    borderBottom: "1px solid #1e2a42",
  };

  const valueStyle = (ready: boolean) => ({
    fontSize: "0.88rem",
    fontWeight: 700,
    color: ready ? "#e2e8f4" : "#4a5878",
  });

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
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "#8496b8",
          letterSpacing: "0.08em",
        }}
      >
        RISK CALCULATOR
      </div>

      {/* Inputs */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e2a42" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={labelStyle}>Account Capital (₹)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              style={inputStyle}
              min="0"
              step="10000"
            />
          </div>
          <div>
            <label style={labelStyle}>Risk % per trade</label>
            <input
              type="number"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              style={inputStyle}
              min="0"
              max="10"
              step="0.5"
            />
          </div>
        </div>
      </div>

      {/* Calculated fields */}
      <div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Risk Budget</span>
          <span style={valueStyle(capitalNum > 0)}>
            {capitalNum > 0
              ? `₹${riskBudget.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
              : "—"}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Entry (from engine)</span>
          <span style={valueStyle(entry !== null)}>
            {entry !== null ? `₹${entry.toFixed(2)}` : "⚠ WAITING FOR ENTRY"}
          </span>
          {entry === null && (
            <div style={{ fontSize: "0.62rem", color: "#4a5878", marginTop: "2px" }}>
              Entry requires verified confirmation rule
            </div>
          )}
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Structural SL</span>
          <span style={valueStyle(sl !== null)}>
            {sl !== null ? `₹${sl.toFixed(2)}` : "⚠ AWAITING REACTION"}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Risk / Share</span>
          <span style={valueStyle(riskPerShare !== null)}>
            {riskPerShare !== null ? `₹${riskPerShare.toFixed(2)}` : "—"}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Lot Size (F&O)</span>
          <span style={valueStyle(true)}>{lotSize}</span>
        </div>

        <div
          style={{
            ...fieldStyle,
            background: qty !== null ? "rgba(0,208,132,0.05)" : "transparent",
            borderBottom: "none",
          }}
        >
          <span style={labelStyle}>Calculated Quantity</span>
          {qty !== null ? (
            <div>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#00d084" }}>
                {qty.toLocaleString("en-IN")} shares
              </span>
              <span style={{ fontSize: "0.72rem", color: "#4a5878", marginLeft: "8px" }}>
                ({lots} lot{lots !== 1 ? "s" : ""})
              </span>
            </div>
          ) : (
            <div>
              <span style={{ fontSize: "0.82rem", color: "#4a5878" }}>
                QTY — WAITING FOR ENTRY/SL
              </span>
              <div style={{ fontSize: "0.62rem", color: "#4a5878", marginTop: "2px" }}>
                Cannot calculate quantity without verified entry and structural SL
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formula note */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid #1e2a42",
          fontSize: "0.62rem",
          color: "#2e3d5a",
        }}
      >
        Formula: Risk Budget = Capital × Risk% | Risk/Share = |Entry − SL| | Qty = floor(Budget ÷ Risk/Share), rounded to lot size
      </div>
    </div>
  );
}
