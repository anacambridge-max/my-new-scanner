/**
 * Market Status Utilities – IST timezone
 *
 * NSE Market Hours: 09:15 – 15:30 IST
 */

import type { MarketStatus } from "@/domain/prime";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function nowIST(): Date {
  const now = new Date();
  return new Date(now.getTime() + IST_OFFSET_MS);
}

export function formatIST(date: Date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS)
    .toISOString()
    .replace("T", " ")
    .substring(0, 19) + " IST";
}

export function getMarketStatus(): MarketStatus {
  const ist = nowIST();
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  // NSE Hours
  const preMarketStart = 9 * 60; // 09:00
  const marketOpen = 9 * 60 + 15; // 09:15
  const marketClose = 15 * 60 + 30; // 15:30

  // Check weekend
  const dayOfWeek = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: "CLOSED",
      label: "CLOSED (Weekend)",
      currentIST: formatIST(),
      openTime: "09:15",
      closeTime: "15:30",
    };
  }

  let status: MarketStatus["status"];
  let label: string;

  if (totalMinutes >= marketOpen && totalMinutes < marketClose) {
    status = "OPEN";
    label = "OPEN";
  } else if (totalMinutes >= preMarketStart && totalMinutes < marketOpen) {
    status = "PRE_MARKET";
    label = "PRE-MARKET";
  } else {
    status = "CLOSED";
    label = "CLOSED";
  }

  return {
    status,
    label,
    currentIST: formatIST(),
    openTime: "09:15",
    closeTime: "15:30",
  };
}

export function isMarketOpen(): boolean {
  return getMarketStatus().status === "OPEN";
}

export function isPreMarket(): boolean {
  return getMarketStatus().status === "PRE_MARKET";
}

/**
 * Returns IST time as HH:MM string.
 */
export function getCurrentISTTime(): string {
  const ist = nowIST();
  const h = ist.getUTCHours().toString().padStart(2, "0");
  const m = ist.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Previous session date (skip weekends).
 */
export function getPreviousSessionDate(): Date {
  const ist = nowIST();
  // If before market open, previous session might be yesterday
  let d = new Date(ist);
  d.setUTCDate(d.getUTCDate() - 1);

  // Skip back over weekends
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

export function formatDateIST(date: Date): string {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
