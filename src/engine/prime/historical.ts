/**
 * PRIME TECHNICAL MASTER — Pine parity historical engine
 *
 * Source of truth: the user's PRIME TECHNICAL MASTER — L1-L12 Pine v6.
 * This intentionally replaces the old V7 bounce/pivot replay.
 */
import type { RawCandle } from "./candle";

export interface HistoricalPrimeSignal {
  direction: "BUY" | "SELL";
  setup: "BREAKOUT" | "BREAKDOWN";
  level: "YH" | "YL";
  triggerPrice: number;
  signalTimestamp: string;
  ema20: number;
  emaTrend: "RISING" | "FALLING" | "FLAT";
  volumeRatio: number;
  volumeStars: 1 | 2 | 3;
  atr14: number;
  sl: number;
  riskPerShare: number;
}

type SessionOHLC = { open: number; high: number; low: number; close: number };

const EMA_LEN = 20;
const ATR_LEN = 14;
const VOL_LEN = 20;
const MIN_VOLUME_MULTIPLE = 1.5;
const MIN_BODY_RATIO = 0.50;
const MIN_CLOSE_LOCATION = 0.60;
const SCAN_START = 9 * 60 + 15;
const SCAN_END = 10 * 60;

function istParts(timestamp: string): { date: string; hour: number; minute: number } {
  const d = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}
function sessionKey(c: RawCandle): string { return istParts(c.timestamp).date; }
function isRegularSession(c: RawCandle): boolean {
  const { hour, minute } = istParts(c.timestamp); const total = hour * 60 + minute;
  return total >= 9 * 60 + 15 && total < 15 * 60 + 30;
}
function inScanWindow(c: RawCandle): boolean {
  const { hour, minute } = istParts(c.timestamp); const total = hour * 60 + minute;
  return total >= SCAN_START && total < SCAN_END;
}
function emaStep(closes: number[], current: number, prev: number | null): number | null {
  if (closes.length < EMA_LEN) return null;
  if (prev === null) return closes.slice(-EMA_LEN).reduce((a, b) => a + b, 0) / EMA_LEN;
  const k = 2 / (EMA_LEN + 1); return current * k + prev * (1 - k);
}
function atrStep(trValues: number[], tr: number, prev: number | null): number | null {
  if (trValues.length < ATR_LEN) return null;
  if (prev === null) return trValues.slice(-ATR_LEN).reduce((a, b) => a + b, 0) / ATR_LEN;
  return ((prev * (ATR_LEN - 1)) + tr) / ATR_LEN;
}
function volumeRatio(volumes: number[], current: number): number | null {
  // Pine ta.sma(volume, 20) includes the current bar.
  if (volumes.length < VOL_LEN) return null;
  const avg = volumes.slice(-VOL_LEN).reduce((a, b) => a + b, 0) / VOL_LEN;
  return avg > 0 ? current / avg : null;
}
function stars(ratio: number): 1 | 2 | 3 { return ratio >= 6.5 ? 3 : ratio >= 4 ? 2 : 1; }
function previousSessionMap(candles: RawCandle[]): Map<string, SessionOHLC> {
  const sessions = new Map<string, RawCandle[]>();
  for (const c of candles) { const key = sessionKey(c); const arr = sessions.get(key) ?? []; arr.push(c); sessions.set(key, arr); }
  const dates = [...sessions.keys()].sort(); const result = new Map<string, SessionOHLC>();
  for (let i = 1; i < dates.length; i++) {
    const prev = sessions.get(dates[i - 1])!;
    result.set(dates[i], { open: prev[0].open, high: Math.max(...prev.map(c => c.high)), low: Math.min(...prev.map(c => c.low)), close: prev[prev.length - 1].close });
  }
  return result;
}

/** Return the first exact Pine-parity PRIME confirmation in the latest session. */
export function findHistoricalPrimeSignal(input: RawCandle[]): HistoricalPrimeSignal | null {
  const candles = input.filter(isRegularSession).slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  if (candles.length < Math.max(EMA_LEN, ATR_LEN, VOL_LEN) + 2) return null;
  const dates = [...new Set(candles.map(sessionKey))].sort();
  if (dates.length < 2) return null;
  const latestSessionDate = dates[dates.length - 1];
  const previousSessions = previousSessionMap(candles);

  let ema: number | null = null, prevEma: number | null = null, prevClose: number | null = null, atr: number | null = null;
  const closes: number[] = [], volumes: number[] = [], trValues: number[] = [];

  for (const c of candles) {
    const sessionDate = sessionKey(c); const previous = previousSessions.get(sessionDate);
    const range = Math.max(0, c.high - c.low);
    const tr = prevClose === null ? range : Math.max(range, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    closes.push(c.close); volumes.push(c.volume); trValues.push(tr);
    prevEma = ema; ema = emaStep(closes, c.close, ema); atr = atrStep(trValues, tr, atr);

    if (!previous || ema === null || atr === null || volumes.length < VOL_LEN) { prevClose = c.close; continue; }
    if (sessionDate !== latestSessionDate || !inScanWindow(c)) { prevClose = c.close; continue; }

    // For 09:15, prevClose is the final close of the previous session.
    const priorClose = prevClose ?? previous.close;
    const bullBreak = c.close > previous.high && priorClose <= previous.high;
    const bearBreak = c.close < previous.low && priorClose >= previous.low;
    if (!bullBreak && !bearBreak) { prevClose = c.close; continue; }

    const bodyRatio = range > 0 ? Math.abs(c.close - c.open) / range : 0;
    const bullish = c.close > c.open, bearish = c.close < c.open;
    const bullCloseLocation = range > 0 ? (c.close - c.low) / range : 0.5;
    const bearCloseLocation = range > 0 ? (c.high - c.close) / range : 0.5;
    const bullReaction = bullish && bodyRatio >= MIN_BODY_RATIO && bullCloseLocation >= MIN_CLOSE_LOCATION;
    const bearReaction = bearish && bodyRatio >= MIN_BODY_RATIO && bearCloseLocation >= MIN_CLOSE_LOCATION;
    const volRatio = volumeRatio(volumes, c.volume);
    if (volRatio === null) { prevClose = c.close; continue; }
    const volumePass = volRatio >= MIN_VOLUME_MULTIPLE;
    const bullConfirmed = bullBreak && bullReaction && volumePass && c.close > ema;
    const bearConfirmed = bearBreak && bearReaction && volumePass && c.close < ema;

    if (bullConfirmed || bearConfirmed) {
      const direction = bullConfirmed ? "BUY" : "SELL";
      const setup = bullConfirmed ? "BREAKOUT" : "BREAKDOWN";
      const level = bullConfirmed ? "YH" : "YL";
      const sl = bullConfirmed ? c.low : c.high;
      const risk = Math.abs(c.close - sl);
      const emaTrend: "RISING" | "FALLING" | "FLAT" = prevEma === null ? "FLAT" : ema > prevEma ? "RISING" : ema < prevEma ? "FALLING" : "FLAT";
      return { direction, setup, level, triggerPrice: Number((bullConfirmed ? previous.high : previous.low).toFixed(2)), signalTimestamp: c.timestamp, ema20: Number(ema.toFixed(2)), emaTrend, volumeRatio: Number(volRatio.toFixed(2)), volumeStars: stars(volRatio), atr14: Number(atr.toFixed(2)), sl: Number(sl.toFixed(2)), riskPerShare: Number(risk.toFixed(2)) };
    }
    prevClose = c.close;
  }
  return null;
}
