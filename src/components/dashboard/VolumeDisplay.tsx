"use client";

import type { VolumeAnalysis } from "./types";

interface VolumeDisplayProps {
  volume: VolumeAnalysis | null;
  compact?: boolean;
}

export default function VolumeDisplay({ volume, compact = false }: VolumeDisplayProps) {
  if (!volume) {
    return <span style={{ color: "#4a5878" }}>—</span>;
  }

  const stars =
    volume.rating === "STAR_3"
      ? "★★★"
      : volume.rating === "STAR_2"
      ? "★★"
      : volume.rating === "STAR_1"
      ? "★"
      : "";

  const starColor =
    volume.rating === "STAR_3"
      ? "#00d084"
      : volume.rating === "STAR_2"
      ? "#ffa502"
      : volume.rating === "STAR_1"
      ? "#3d8bff"
      : "#4a5878";

  if (compact) {
    return (
      <span title={`${volume.ratio.toFixed(1)}× avg`}>
        {stars ? (
          <span style={{ color: starColor, fontSize: "0.75rem" }}>{stars}</span>
        ) : (
          <span style={{ color: "#4a5878", fontSize: "0.72rem" }}>NML</span>
        )}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {stars ? (
        <span style={{ color: starColor, fontSize: "0.82rem", letterSpacing: "2px" }}>{stars}</span>
      ) : (
        <span style={{ color: "#4a5878", fontSize: "0.72rem" }}>NORMAL</span>
      )}
      <span style={{ color: "#8496b8", fontSize: "0.68rem" }}>{volume.ratio.toFixed(1)}× avg</span>
      {volume.isOpeningCandle && (
        <span style={{ color: "#ffa502", fontSize: "0.62rem" }}>OPEN CANDLE</span>
      )}
    </div>
  );
}
