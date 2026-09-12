"use client";

import type { PrimeScanRow } from "./types";
import StateBadge from "./StateBadge";
import VolumeDisplay from "./VolumeDisplay";

interface DiscoveryPanelProps {
  rows: PrimeScanRow[];
  isLoading: boolean;
  onSelectRow: (row: PrimeScanRow) => void;
}

/**
 * 09:15–09:20 Discovery Panel
 *
 * Purpose: Discovery only. NOT automatic entry.
 * The opening candle has structurally different volume characteristics
 * and must not be compared directly to normal intraday candles.
 */
export default function DiscoveryPanel({
  rows,
  isLoading,
  onSelectRow,
}: DiscoveryPanelProps) {
  // Filter for stocks where the latest candle is the opening candle
  const discoveryRows = rows.filter(
    (r) => r.candle && r.volume?.isOpeningCandle
  );

  return (
    <div
      style={{
        background: "#131929",
        border: "1px solid #1e2a42",
        borderRadius: "6px",
        overflow: "hidden",
        margin: "0 16px 12px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#ffa502",
              letterSpacing: "0.08em",
            }}
          >
            09:15–09:20 DISCOVERY
          </span>
          <span
            style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: "3px",
              background: "rgba(255,165,2,0.15)",
              color: "#ffa502",
              border: "1px solid rgba(255,165,2,0.35)",
            }}
          >
            DISCOVERY — NOT ENTRY
          </span>
        </div>
        <span style={{ fontSize: "0.65rem", color: "#4a5878" }}>
          {discoveryRows.length} candidates
        </span>
      </div>

      {/* Warning */}
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid #1e2a42",
          background: "rgba(255,165,2,0.04)",
          fontSize: "0.68rem",
          color: "#8496b8",
          lineHeight: "1.5",
        }}
      >
        ⚠ Opening candle (09:15–09:20) volume is structurally different from intraday volume.
        Discovery here does NOT constitute a trade signal. Use this section to identify stocks
        deserving attention — confirm later with standard Prime Technical criteria.
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ padding: "20px 14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: "70px", width: "160px", borderRadius: "6px" }} />
          ))}
        </div>
      ) : discoveryRows.length === 0 ? (
        <div
          style={{
            padding: "20px 14px",
            color: "#4a5878",
            fontSize: "0.75rem",
            textAlign: "center",
          }}
        >
          No opening candle data available. Discovery panel activates during 09:15–09:20 IST.
        </div>
      ) : (
        <div
          style={{
            padding: "10px 14px",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {discoveryRows.map((row) => {
            const pctColor =
              row.dayChangePct !== null && row.dayChangePct > 0
                ? "#00d084"
                : row.dayChangePct !== null && row.dayChangePct < 0
                ? "#ff4757"
                : "#8496b8";

            return (
              <div
                key={row.symbol}
                onClick={() => onSelectRow(row)}
                style={{
                  padding: "10px 12px",
                  background: "#0f1525",
                  border: "1px solid #1e2a42",
                  borderRadius: "6px",
                  cursor: "pointer",
                  minWidth: "150px",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#ffa502";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2a42";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e2e8f4" }}>
                    {row.symbol}
                  </span>
                  <StateBadge state={row.state} size="sm" />
                </div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#3d8bff" }}>
                  {row.ltp !== null ? `₹${row.ltp.toFixed(2)}` : "—"}
                  <span style={{ fontSize: "0.68rem", color: pctColor, marginLeft: "6px" }}>
                    {row.dayChangePct !== null
                      ? `${row.dayChangePct > 0 ? "+" : ""}${row.dayChangePct.toFixed(2)}%`
                      : ""}
                  </span>
                </div>
                <div style={{ marginTop: "4px" }}>
                  <VolumeDisplay volume={row.volume} compact />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
