"use client";

interface LevelPanelProps {
  ltp: number | null;
  yh: number | null;
  yl: number | null;
}

export default function LevelPanel({ ltp, yh, yl }: LevelPanelProps) {
  const formatDist = (val: number, ref: number) => {
    const diff = val - ref;
    const pct = ref > 0 ? (diff / ref) * 100 : 0;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  };

  const distColor = (val: number, ref: number) => {
    const diff = val - ref;
    if (Math.abs(diff) < ref * 0.005) return "#ffa502";
    return diff > 0 ? "#00d084" : "#ff4757";
  };

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
          textTransform: "uppercase",
        }}
      >
        LEVEL ANALYSIS
      </div>

      {/* Current Price */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #1e2a42",
          background: "rgba(61,139,255,0.06)",
        }}
      >
        <div style={{ fontSize: "0.6rem", color: "#4a5878", letterSpacing: "0.06em" }}>CURRENT PRICE (LTP)</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#3d8bff", marginTop: "3px" }}>
          {ltp !== null ? `₹${ltp.toFixed(2)}` : "—"}
        </div>
      </div>

      {/* Verified Levels */}
      <div style={{ padding: "8px 14px 4px" }}>
        <div style={{ fontSize: "0.6rem", color: "#00d084", letterSpacing: "0.08em", marginBottom: "6px" }}>
          ✓ VERIFIED LEVELS
        </div>

        {/* YH */}
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(0,208,132,0.05)",
            border: "1px solid rgba(0,208,132,0.15)",
            borderRadius: "5px",
            marginBottom: "6px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.6rem", color: "#00d084", letterSpacing: "0.06em", fontWeight: 700 }}>
                YESTERDAY HIGH (YH)
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#00d084", marginTop: "2px" }}>
                {yh !== null ? `₹${yh.toFixed(2)}` : "—"}
              </div>
            </div>
            {ltp !== null && yh !== null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.6rem", color: "#4a5878" }}>DISTANCE</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: distColor(ltp, yh) }}>
                  {formatDist(ltp, yh)}
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: "0.65rem", color: "#4a5878", marginTop: "4px" }}>
            "Do not trade the line. Trade the reaction to the line."
          </div>
        </div>

        {/* YL */}
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(255,71,87,0.05)",
            border: "1px solid rgba(255,71,87,0.15)",
            borderRadius: "5px",
            marginBottom: "6px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.6rem", color: "#ff4757", letterSpacing: "0.06em", fontWeight: 700 }}>
                YESTERDAY LOW (YL)
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ff4757", marginTop: "2px" }}>
                {yl !== null ? `₹${yl.toFixed(2)}` : "—"}
              </div>
            </div>
            {ltp !== null && yl !== null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.6rem", color: "#4a5878" }}>DISTANCE</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: distColor(ltp, yl) }}>
                  {formatDist(ltp, yl)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOT VERIFIED levels */}
      <div style={{ padding: "4px 14px 12px" }}>
        <div style={{ fontSize: "0.6rem", color: "#ffa502", letterSpacing: "0.08em", marginBottom: "6px" }}>
          ⚠ RULE NOT VERIFIED FROM PRIME TECHNICAL MANUAL
        </div>
        {["MID", "R1", "R2", "R3", "S1", "S2", "S3"].map((level) => (
          <div
            key={level}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 12px",
              background: "rgba(74,88,120,0.06)",
              border: "1px solid rgba(74,88,120,0.15)",
              borderRadius: "4px",
              marginBottom: "3px",
            }}
          >
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#4a5878" }}>{level}</span>
            <span style={{ fontSize: "0.65rem", color: "#4a5878", fontStyle: "italic" }}>
              PENDING RULE VERIFICATION
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
