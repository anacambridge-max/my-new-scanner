"use client";

import { useState, useEffect, useCallback } from "react";
import type { PrimeScanRow, PrimeScanResponse, StatusInfo } from "./types";
import SummaryCards from "./SummaryCards";
import ScannerTable from "./ScannerTable";
import StockDetailDrawer from "./StockDetailDrawer";
import DiscoveryPanel from "./DiscoveryPanel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useISTClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

function getMarketLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "OPEN":
      return { label: "OPEN", color: "#00d084" };
    case "PRE_MARKET":
      return { label: "PRE-MARKET", color: "#ffa502" };
    case "HOLIDAY":
      return { label: "HOLIDAY", color: "#4a5878" };
    default:
      return { label: "CLOSED", color: "#ff4757" };
  }
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [scanData, setScanData] = useState<PrimeScanResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<PrimeScanRow | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [upstoxError, setUpstoxError] = useState<string | null>(null);

  const istTime = useISTClock();

  // ── Load status ─────────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/upstox/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // network error
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // ── Run scanner ─────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    setIsLoadingScan(true);
    setScanError(null);
    try {
      const res = await fetch("/api/upstox/prime-scan-all");
      const data: PrimeScanResponse = await res.json();
      setScanData(data);
      setLastScanTime(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
      if (data.error) {
        setScanError(data.error);
      }
    } catch (err) {
      setScanError(String(err));
    } finally {
      setIsLoadingScan(false);
    }
  }, []);

  // ── On mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Check for URL params from OAuth callback
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("upstox_connected");
    const error = params.get("upstox_error");
    if (connected) {
      window.history.replaceState({}, "", "/");
    }
    if (error) {
      setUpstoxError(decodeURIComponent(error));
      window.history.replaceState({}, "", "/");
    }

    loadStatus();
  }, [loadStatus]);

  // ── Auto-refresh status every 60s ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(loadStatus, 60_000);
    return () => clearInterval(id);
  }, [loadStatus]);

  const isConnected = status?.upstox?.connected && !status?.upstox?.expired;
  const marketStatus = status?.market?.status || "CLOSED";
  const { label: mktLabel, color: mktColor } = getMarketLabel(marketStatus);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "#0a0e1a",
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header
        style={{
          background: "#0c1120",
          borderBottom: "1px solid #1e2a42",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          height: "52px",
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <span
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#e2e8f4",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            PRIME TECHNICAL MASTER
          </span>
          <span style={{ fontSize: "0.58rem", color: "#4a5878", letterSpacing: "0.08em" }}>
            NSE F&amp;O • Prime Technical Scanner • Upstox Market Data
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: "1px", height: "30px", background: "#1e2a42", flexShrink: 0 }} />

        {/* Market Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: mktColor,
              flexShrink: 0,
            }}
            className={marketStatus === "OPEN" ? "pulse" : ""}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: mktColor, letterSpacing: "0.06em" }}>
              NSE {mktLabel}
            </span>
            <span style={{ fontSize: "0.6rem", color: "#4a5878" }}>09:15–15:30 IST</span>
          </div>
        </div>

        {/* IST Clock */}
        <div style={{ fontSize: "0.78rem", color: "#8496b8", fontWeight: 600, letterSpacing: "0.04em" }}>
          {istTime} IST
        </div>

        <div style={{ width: "1px", height: "30px", background: "#1e2a42", flexShrink: 0 }} />

        {/* Upstox Status */}
        {isLoadingStatus ? (
          <div className="skeleton" style={{ height: "24px", width: "140px", borderRadius: "4px" }} />
        ) : isConnected ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#00d084",
              }}
              className="pulse"
            />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#00d084", letterSpacing: "0.06em" }}>
              UPSTOX CONNECTED
            </span>
            {status?.upstox?.expiresAt && (
              <span style={{ fontSize: "0.6rem", color: "#4a5878" }}>
                exp {new Date(status.upstox.expiresAt).toLocaleDateString("en-IN")}
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#ff4757",
              }}
            />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ff4757", letterSpacing: "0.06em" }}>
              {status?.upstox?.expired ? "SESSION EXPIRED" : "UPSTOX DISCONNECTED"}
            </span>
          </div>
        )}

        {/* Last scan */}
        {lastScanTime && (
          <div style={{ fontSize: "0.62rem", color: "#4a5878" }}>
            Last scan: {lastScanTime}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Live feed status */}
        <div
          style={{
            fontSize: "0.6rem",
            color: "#2e3d5a",
            padding: "3px 8px",
            border: "1px solid #1e2a42",
            borderRadius: "3px",
          }}
        >
          LIVE FEED — WAITING FOR MARKET DATA WORKER
        </div>

        {/* Action Buttons */}
        {!isConnected && (
          <a
            href="/api/upstox/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 14px",
              background: "rgba(61,139,255,0.12)",
              border: "1px solid rgba(61,139,255,0.4)",
              borderRadius: "4px",
              color: "#3d8bff",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            CONNECT UPSTOX
          </a>
        )}

        <button
          onClick={runScan}
          disabled={isLoadingScan}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            background: isLoadingScan
              ? "rgba(0,208,132,0.05)"
              : "rgba(0,208,132,0.12)",
            border: `1px solid ${isLoadingScan ? "rgba(0,208,132,0.2)" : "rgba(0,208,132,0.4)"}`,
            borderRadius: "4px",
            color: "#00d084",
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            cursor: isLoadingScan ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {isLoadingScan ? (
            <>
              <span className="pulse">◉</span> SCANNING...
            </>
          ) : (
            <>◎ SCAN NOW</>
          )}
        </button>
      </header>

      {/* ── ERROR BANNERS ───────────────────────────────────────────────────── */}
      {upstoxError && (
        <div
          style={{
            background: "rgba(255,71,87,0.1)",
            border: "1px solid rgba(255,71,87,0.3)",
            borderRadius: 0,
            padding: "8px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#ff4757" }}>
            ⚠ Upstox OAuth error: {upstoxError}
          </span>
          <button
            onClick={() => setUpstoxError(null)}
            style={{ background: "none", border: "none", color: "#ff4757", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Disconnected Banner */}
      {!isLoadingStatus && !isConnected && !upstoxError && (
        <div
          style={{
            background: "rgba(255,71,87,0.06)",
            borderBottom: "1px solid rgba(255,71,87,0.2)",
            padding: "8px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#ff4757" }}>
            ⚠{" "}
            {status?.upstox?.expired
              ? "UPSTOX SESSION EXPIRED — Reconnect Upstox to resume scanning."
              : "UPSTOX DISCONNECTED — Connect Upstox to start market scanning."}
          </span>
          <a
            href="/api/upstox/login"
            style={{
              padding: "4px 12px",
              background: "rgba(61,139,255,0.12)",
              border: "1px solid rgba(61,139,255,0.4)",
              borderRadius: "3px",
              color: "#3d8bff",
              fontSize: "0.68rem",
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "0.06em",
            }}
          >
            CONNECT UPSTOX
          </a>
        </div>
      )}

      {/* Scan error */}
      {scanError && scanError !== "UPSTOX_DISCONNECTED" && (
        <div
          style={{
            background: "rgba(255,165,2,0.06)",
            borderBottom: "1px solid rgba(255,165,2,0.2)",
            padding: "6px 16px",
            fontSize: "0.72rem",
            color: "#ffa502",
            flexShrink: 0,
          }}
        >
          ⚠ Scanner error: {scanError}
        </div>
      )}

      {/* ── SUMMARY CARDS ───────────────────────────────────────────────────── */}
      <SummaryCards
        rows={scanData?.rows ?? []}
        universeCount={scanData?.universeCount ?? 50}
        isLoading={isLoadingScan}
      />

      {/* ── DISCOVERY PANEL ─────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <DiscoveryPanel
          rows={scanData?.rows ?? []}
          isLoading={isLoadingScan}
          onSelectRow={setSelectedRow}
        />
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", position: "relative" }}>
        {/* Scanner table */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            marginRight: selectedRow ? "480px" : "0",
            transition: "margin-right 0.2s ease",
          }}
        >
          {/* No scan data yet */}
          {!scanData && !isLoadingScan ? (
            <NoScanState
              isConnected={!!isConnected}
              onScan={runScan}
              isScanning={isLoadingScan}
            />
          ) : (
            <ScannerTable
              rows={scanData?.rows ?? []}
              isLoading={isLoadingScan}
              onSelectRow={setSelectedRow}
              selectedSymbol={selectedRow?.symbol ?? null}
            />
          )}
        </div>

        {/* Detail drawer */}
        {selectedRow && (
          <StockDetailDrawer
            row={selectedRow}
            onClose={() => setSelectedRow(null)}
          />
        )}
      </div>

      {/* ── STATUS BAR ──────────────────────────────────────────────────────── */}
      <footer
        style={{
          background: "#0c1120",
          borderTop: "1px solid #1e2a42",
          padding: "4px 16px",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexShrink: 0,
          height: "28px",
        }}
      >
        <span style={{ fontSize: "0.6rem", color: "#2e3d5a" }}>
          PRIME TECHNICAL MASTER v1.0 — NSE F&O Scanner
        </span>
        <span style={{ fontSize: "0.6rem", color: "#2e3d5a" }}>
          Scanner ranking is NOT investment advice
        </span>
        {scanData && (
          <span style={{ fontSize: "0.6rem", color: "#2e3d5a" }}>
            Universe: {scanData.universeCount} | Scanned: {scanData.scanCount} | Generated:{" "}
            {new Date(scanData.generatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.6rem", color: "#1e2a42" }}>
          MID/R1/R2/R3/S1/S2/S3 formula PENDING RULE VERIFICATION from Prime Technical manual
        </span>
      </footer>
    </div>
  );
}

// ─── No Scan State ────────────────────────────────────────────────────────────

function NoScanState({
  isConnected,
  onScan,
  isScanning,
}: {
  isConnected: boolean;
  onScan: () => void;
  isScanning: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: "20px",
        color: "#4a5878",
      }}
    >
      {/* ASCII-style terminal art */}
      <pre
        style={{
          fontSize: "0.6rem",
          color: "#1e2a42",
          lineHeight: "1.2",
          fontFamily: "inherit",
          textAlign: "center",
        }}
      >
        {`
  ██████╗ ██████╗ ██╗███╗   ███╗███████╗
  ██╔══██╗██╔══██╗██║████╗ ████║██╔════╝
  ██████╔╝██████╔╝██║██╔████╔██║█████╗
  ██╔═══╝ ██╔══██╗██║██║╚██╔╝██║██╔══╝
  ██║     ██║  ██║██║██║ ╚═╝ ██║███████╗
  ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝
        `}
      </pre>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#8496b8",
            letterSpacing: "0.12em",
            marginBottom: "8px",
          }}
        >
          PRIME TECHNICAL MASTER
        </div>
        <div style={{ fontSize: "0.75rem", color: "#4a5878", marginBottom: "4px" }}>
          NSE F&amp;O Scanner — Prime Technical Framework
        </div>
        <div style={{ fontSize: "0.68rem", color: "#2e3d5a" }}>
          {isConnected
            ? 'Press "SCAN NOW" to run the Prime scanner across the F&O universe'
            : "Connect Upstox to access live market data and run the scanner"}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        {!isConnected && (
          <a
            href="/api/upstox/login"
            style={{
              padding: "10px 24px",
              background: "rgba(61,139,255,0.12)",
              border: "1px solid rgba(61,139,255,0.4)",
              borderRadius: "5px",
              color: "#3d8bff",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            CONNECT UPSTOX
          </a>
        )}

        <button
          onClick={onScan}
          disabled={isScanning}
          style={{
            padding: "10px 24px",
            background: "rgba(0,208,132,0.12)",
            border: "1px solid rgba(0,208,132,0.4)",
            borderRadius: "5px",
            color: "#00d084",
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: isScanning ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {isScanning ? "SCANNING..." : "◎ SCAN NOW"}
        </button>
      </div>

      <div
        style={{
          fontSize: "0.65rem",
          color: "#2e3d5a",
          textAlign: "center",
          maxWidth: "500px",
          lineHeight: "1.6",
        }}
      >
        "Do not trade the line. Trade the reaction to the line."
        <br />
        Prime Technical Master · NSE F&amp;O · Level → Reaction → Candle → Volume → 20 EMA → Confirmation → SL → QTY
      </div>
    </div>
  );
}
