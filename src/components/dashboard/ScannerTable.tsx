"use client";

import { useState, useMemo } from "react";
import type { PrimeScanRow, PrimeScanState, PrimeDirection } from "./types";
import StateBadge from "./StateBadge";
import VolumeDisplay from "./VolumeDisplay";

interface ScannerTableProps {
  rows: PrimeScanRow[];
  isLoading: boolean;
  onSelectRow: (row: PrimeScanRow) => void;
  selectedSymbol: string | null;
}

type SortKey =
  | "rank"
  | "symbol"
  | "ltp"
  | "dayChangePct"
  | "volumeRatio"
  | "score"
  | "state";

type SortDir = "asc" | "desc";

type FilterState = "ALL" | PrimeScanState;
type FilterDirection = "ALL" | PrimeDirection;

export default function ScannerTable({
  rows,
  isLoading,
  onSelectRow,
  selectedSymbol,
}: ScannerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterState, setFilterState] = useState<FilterState>("ALL");
  const [filterDirection, setFilterDirection] = useState<FilterDirection>("ALL");
  const [filterVolume, setFilterVolume] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const filtered = useMemo(() => {
    let result = [...rows];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }

    if (filterState !== "ALL") {
      result = result.filter((r) => r.state === filterState);
    }

    if (filterDirection !== "ALL") {
      result = result.filter((r) => r.direction === filterDirection);
    }

    if (filterVolume !== "ALL") {
      result = result.filter((r) => r.volume?.rating === filterVolume);
    }

    // Sort
    result.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;

      switch (sortKey) {
        case "rank":
          av = a.rank;
          bv = b.rank;
          break;
        case "symbol":
          av = a.symbol;
          bv = b.symbol;
          break;
        case "ltp":
          av = a.ltp ?? -Infinity;
          bv = b.ltp ?? -Infinity;
          break;
        case "dayChangePct":
          av = a.dayChangePct ?? -Infinity;
          bv = b.dayChangePct ?? -Infinity;
          break;
        case "volumeRatio":
          av = a.volume?.ratio ?? 0;
          bv = b.volume?.ratio ?? 0;
          break;
        case "score":
          av = a.score;
          bv = b.score;
          break;
        case "state":
          av = a.state;
          bv = b.state;
          break;
      }

      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return result;
  }, [rows, searchQuery, filterState, filterDirection, filterVolume, sortKey, sortDir]);

  const thStyle = (key: SortKey): React.CSSProperties => ({
    cursor: "pointer",
    userSelect: "none",
    color: sortKey === key ? "#e2e8f4" : "#8496b8",
  });

  const filterBtnStyle = (active: boolean, color = "#3d8bff"): React.CSSProperties => ({
    padding: "4px 10px",
    fontSize: "0.65rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    borderRadius: "3px",
    border: `1px solid ${active ? color : "#1e2a42"}`,
    background: active ? `${color}20` : "transparent",
    color: active ? color : "#8496b8",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  });

  const STATE_FILTERS: Array<{ value: FilterState; label: string; color?: string }> = [
    { value: "ALL", label: "ALL" },
    { value: "SETUP", label: "SETUP", color: "#3d8bff" },
    { value: "CONFIRMED", label: "CONFIRMED", color: "#00d084" },
    { value: "FAKE_BREAKOUT", label: "FAKE BKT", color: "#a855f7" },
    { value: "WATCH", label: "WATCH", color: "#ffa502" },
    { value: "NO_TRADE", label: "NO TRADE", color: "#4a5878" },
    { value: "INVALID", label: "INVALID", color: "#ff4757" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "10px 16px",
          borderBottom: "1px solid #1e2a42",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search symbol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: "#0a0e1a",
            border: "1px solid #1e2a42",
            borderRadius: "4px",
            color: "#e2e8f4",
            fontSize: "0.75rem",
            padding: "5px 10px",
            fontFamily: "inherit",
            outline: "none",
            width: "140px",
          }}
        />

        <span style={{ color: "#2e3d5a", fontSize: "0.7rem" }}>|</span>

        {/* State filters */}
        {STATE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterState(f.value)}
            style={filterBtnStyle(filterState === f.value, f.color)}
          >
            {f.label}
          </button>
        ))}

        <span style={{ color: "#2e3d5a", fontSize: "0.7rem" }}>|</span>

        {/* Direction filters */}
        {(["ALL", "BUY", "SELL"] as FilterDirection[]).map((d) => (
          <button
            key={d}
            onClick={() => setFilterDirection(d)}
            style={filterBtnStyle(
              filterDirection === d,
              d === "BUY" ? "#00d084" : d === "SELL" ? "#ff4757" : "#8496b8"
            )}
          >
            {d === "BUY" ? "⬆ BUY" : d === "SELL" ? "⬇ SELL" : "ALL DIR"}
          </button>
        ))}

        <span style={{ color: "#2e3d5a", fontSize: "0.7rem" }}>|</span>

        {/* Volume filter */}
        {(["ALL", "STAR_3", "STAR_2", "STAR_1"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilterVolume(v)}
            style={filterBtnStyle(filterVolume === v, "#ffa502")}
          >
            {v === "ALL" ? "ALL VOL" : v === "STAR_3" ? "★★★" : v === "STAR_2" ? "★★" : "★"}
          </button>
        ))}

        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.65rem",
            color: "#4a5878",
          }}
        >
          {filtered.length} / {rows.length} shown
        </span>
      </div>

      {/* Table container */}
      <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
        {isLoading ? (
          <SkeletonTable />
        ) : filtered.length === 0 ? (
          <EmptyState hasData={rows.length > 0} />
        ) : (
          <table className="terminal-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("rank")} style={thStyle("rank")}>
                  #{sortArrow("rank")}
                </th>
                <th onClick={() => handleSort("symbol")} style={thStyle("symbol")}>
                  STOCK{sortArrow("symbol")}
                </th>
                <th onClick={() => handleSort("ltp")} style={thStyle("ltp")}>
                  LTP{sortArrow("ltp")}
                </th>
                <th onClick={() => handleSort("dayChangePct")} style={thStyle("dayChangePct")}>
                  DAY %{sortArrow("dayChangePct")}
                </th>
                <th>YH</th>
                <th>YL</th>
                <th>MID</th>
                <th>LOCATION</th>
                <th>REACTION</th>
                <th>CANDLE</th>
                <th onClick={() => handleSort("volumeRatio")} style={thStyle("volumeRatio")}>
                  VOLUME{sortArrow("volumeRatio")}
                </th>
                <th>20 EMA</th>
                <th>DIRECTION</th>
                <th onClick={() => handleSort("state")} style={thStyle("state")}>
                  STATE{sortArrow("state")}
                </th>
                <th>ENTRY</th>
                <th>SL</th>
                <th>RISK/SH</th>
                <th onClick={() => handleSort("score")} style={thStyle("score")}>
                  SCORE{sortArrow("score")}
                </th>
                <th>UPDATED</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <ScannerRow
                  key={row.symbol}
                  row={row}
                  selected={row.symbol === selectedSymbol}
                  onSelect={onSelectRow}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ScannerRow({
  row,
  selected,
  onSelect,
}: {
  row: PrimeScanRow;
  selected: boolean;
  onSelect: (r: PrimeScanRow) => void;
}) {
  const pctColor =
    row.dayChangePct !== null && row.dayChangePct > 0
      ? "#00d084"
      : row.dayChangePct !== null && row.dayChangePct < 0
      ? "#ff4757"
      : "#8496b8";

  const dirColor =
    row.direction === "BUY"
      ? "#00d084"
      : row.direction === "SELL"
      ? "#ff4757"
      : "#4a5878";

  const emaColor =
    row.ema?.position === "ABOVE"
      ? "#00d084"
      : row.ema?.position === "BELOW"
      ? "#ff4757"
      : "#8496b8";

  const ts = new Date(row.updatedAt);
  const timeStr = isNaN(ts.getTime())
    ? "—"
    : ts.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

  const reactionShort =
    row.reaction.reactionType === "BULLISH_REACTION"
      ? "▲ BULL"
      : row.reaction.reactionType === "BEARISH_REACTION"
      ? "▼ BEAR"
      : row.reaction.reactionType === "NEUTRAL"
      ? "◐"
      : "—";
  const reactionColor =
    row.reaction.reactionType === "BULLISH_REACTION"
      ? "#00d084"
      : row.reaction.reactionType === "BEARISH_REACTION"
      ? "#ff4757"
      : "#4a5878";

  return (
    <tr
      className={selected ? "selected" : ""}
      onClick={() => onSelect(row)}
      title={row.reason}
    >
      <td style={{ color: "#4a5878", fontWeight: 600 }}>{row.rank}</td>
      <td>
        <div style={{ fontWeight: 700, color: "#e2e8f4", fontSize: "0.8rem" }}>
          {row.symbol}
        </div>
        <div style={{ fontSize: "0.62rem", color: "#4a5878" }}>{row.name.substring(0, 20)}</div>
      </td>
      <td style={{ fontWeight: 600, color: "#3d8bff" }}>
        {row.ltp !== null ? `₹${row.ltp.toFixed(2)}` : "—"}
      </td>
      <td style={{ color: pctColor, fontWeight: 600 }}>
        {row.dayChangePct !== null
          ? `${row.dayChangePct > 0 ? "+" : ""}${row.dayChangePct.toFixed(2)}%`
          : "—"}
      </td>
      <td style={{ color: "#00d084" }}>
        {row.yh !== null ? `₹${row.yh.toFixed(2)}` : "—"}
      </td>
      <td style={{ color: "#ff4757" }}>
        {row.yl !== null ? `₹${row.yl.toFixed(2)}` : "—"}
      </td>
      <td style={{ color: "#4a5878", fontSize: "0.65rem", fontStyle: "italic" }}>
        N/V
      </td>
      <td>
        <LocationBadge location={row.location} />
      </td>
      <td style={{ color: reactionColor, fontSize: "0.72rem", fontWeight: 600 }}>
        {reactionShort}
      </td>
      <td>
        {row.candle ? (
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              color:
                row.candle.type === "BULLISH"
                  ? "#00d084"
                  : row.candle.type === "BEARISH"
                  ? "#ff4757"
                  : "#8496b8",
            }}
          >
            {row.candle.type.substring(0, 4)}
          </span>
        ) : (
          <span style={{ color: "#4a5878" }}>—</span>
        )}
      </td>
      <td>
        <VolumeDisplay volume={row.volume} compact />
      </td>
      <td style={{ color: emaColor, fontSize: "0.72rem", fontWeight: 600 }}>
        {row.ema?.position ?? "—"}
      </td>
      <td style={{ color: dirColor, fontWeight: 700, fontSize: "0.72rem" }}>
        {row.direction === "BUY" ? "⬆ BUY" : row.direction === "SELL" ? "⬇ SELL" : "—"}
      </td>
      <td>
        <StateBadge state={row.state} size="sm" />
      </td>
      <td style={{ color: "#4a5878" }}>
        {row.entry !== null ? `₹${row.entry.toFixed(2)}` : "—"}
      </td>
      <td style={{ color: row.sl !== null ? "#ff4757" : "#4a5878" }}>
        {row.sl !== null ? `₹${row.sl.toFixed(2)}` : "—"}
      </td>
      <td style={{ color: "#4a5878" }}>
        {row.riskPerShare !== null ? `₹${row.riskPerShare.toFixed(2)}` : "—"}
      </td>
      <td style={{ color: "#ffa502", fontWeight: 600 }}>{row.score}</td>
      <td style={{ color: "#2e3d5a", fontSize: "0.65rem" }}>{timeStr}</td>
    </tr>
  );
}

function LocationBadge({ location }: { location: string }) {
  const cfg: Record<string, { color: string; bg: string }> = {
    NEAR_YH: { color: "#00d084", bg: "rgba(0,208,132,0.1)" },
    ABOVE_YH: { color: "#00d084", bg: "rgba(0,208,132,0.08)" },
    NEAR_YL: { color: "#ff4757", bg: "rgba(255,71,87,0.1)" },
    BELOW_YL: { color: "#ff4757", bg: "rgba(255,71,87,0.08)" },
    UPPER_RANGE: { color: "#3d8bff", bg: "rgba(61,139,255,0.08)" },
    LOWER_RANGE: { color: "#ffa502", bg: "rgba(255,165,2,0.08)" },
    MID_RANGE: { color: "#8496b8", bg: "rgba(132,150,184,0.08)" },
  };

  const c = cfg[location] || { color: "#4a5878", bg: "transparent" };

  return (
    <span
      style={{
        fontSize: "0.62rem",
        fontWeight: 600,
        color: c.color,
        background: c.bg,
        padding: "1px 5px",
        borderRadius: "3px",
        letterSpacing: "0.04em",
      }}
    >
      {location.replace(/_/g, " ")}
    </span>
  );
}

function SkeletonTable() {
  return (
    <table className="terminal-table">
      <thead>
        <tr>
          {Array.from({ length: 19 }).map((_, i) => (
            <th key={i}>
              <div className="skeleton" style={{ height: "10px", width: "40px" }} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 15 }).map((_, i) => (
          <tr key={i}>
            {Array.from({ length: 19 }).map((_, j) => (
              <td key={j}>
                <div className="skeleton" style={{ height: "12px", width: "60px" }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState({ hasData }: { hasData: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        color: "#4a5878",
      }}
    >
      <div style={{ fontSize: "2rem", marginBottom: "12px" }}>◈</div>
      <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "6px" }}>
        {hasData ? "No matching candidates" : "NO PRIME SETUPS CURRENTLY"}
      </div>
      <div style={{ fontSize: "0.72rem", color: "#2e3d5a" }}>
        {hasData
          ? "Adjust filters to see more candidates."
          : "Run scanner or connect Upstox to begin scanning."}
      </div>
    </div>
  );
}
