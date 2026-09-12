"use client";

import type { PrimePipelineStage, StageResult } from "./types";

interface PrimePipelineProps {
  pipeline: PrimePipelineStage[];
  compact?: boolean;
}

const STAGE_COLORS: Record<StageResult, { bg: string; text: string; icon: string }> = {
  PASS: { bg: "rgba(0,208,132,0.12)", text: "#00d084", icon: "✓" },
  WAIT: { bg: "rgba(255,165,2,0.12)", text: "#ffa502", icon: "◐" },
  FAIL: { bg: "rgba(255,71,87,0.12)", text: "#ff4757", icon: "✗" },
  NOT_AVAILABLE: { bg: "rgba(74,88,120,0.1)", text: "#4a5878", icon: "—" },
};

export default function PrimePipeline({ pipeline, compact = false }: PrimePipelineProps) {
  if (!pipeline || pipeline.length === 0) return null;

  if (compact) {
    return (
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {pipeline.map((stage) => {
          const cfg = STAGE_COLORS[stage.result];
          return (
            <span
              key={stage.name}
              title={`${stage.name}: ${stage.detail || stage.result}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "1px 5px",
                borderRadius: "3px",
                background: cfg.bg,
                color: cfg.text,
                fontSize: "0.62rem",
                fontWeight: 600,
                border: `1px solid ${cfg.text}30`,
                whiteSpace: "nowrap",
              }}
            >
              {cfg.icon} {stage.name}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {pipeline.map((stage, idx) => {
        const cfg = STAGE_COLORS[stage.result];
        return (
          <div key={stage.name}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "5px",
                background: cfg.bg,
                border: `1px solid ${cfg.text}25`,
              }}
            >
              {/* Stage icon */}
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: cfg.text + "20",
                  border: `1px solid ${cfg.text}60`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: cfg.text,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {cfg.icon}
              </span>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: cfg.text,
                    letterSpacing: "0.06em",
                  }}
                >
                  {stage.name}
                </div>
                {stage.detail && (
                  <div style={{ fontSize: "0.67rem", color: "#8496b8", marginTop: "1px" }}>
                    {stage.detail}
                  </div>
                )}
              </div>

              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  color: cfg.text,
                  letterSpacing: "0.06em",
                  opacity: 0.8,
                }}
              >
                {stage.result}
              </span>
            </div>

            {idx < pipeline.length - 1 && (
              <div
                style={{
                  width: "1px",
                  height: "4px",
                  background: "#1e2a42",
                  margin: "0 20px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
