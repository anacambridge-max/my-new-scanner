/**
 * PRIME TECHNICAL MASTER – Historical Signal Engine
 *
 * Replays the Pine V7 setup rules over the available 5-minute history so the
 * dashboard can show the first PRIME signal that actually qualified in the
 * latest session, including the 09:15 opening candle when it qualifies.
 */

import type { RawCandle } from "./candle";

export interface HistoricalPrimeSignal {
  direction: "BUY" | "SELL";
  setup: "BOUNCE" | "BREAKOUT" | "REJECTION" | "BREAKDOWN";
  level: string;
  triggerPrice: number;
  signalTimestamp: string;
  ema20: number;
  emaTrend: "RISING" | "FALLING";
  volumeRatio: number;
  volumeStars: 1 | 2 | 3;
  atr14: number;
  sl: number;
  riskPerShare: number;
}

type SessionOHLC = { open: number; high: number; low: number; close: number };
type LevelSet = { yh: number; yl: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };

const EMA_LEN = 20;
const ATR_LEN = 14;
const VOL_LEN = 20;
const LEVEL_TOL_ATR = 0.3;
const ROOM_ATR = 0.75;
const SL_BUFFER_ATR = 0.2;
const STAR1 = 2.0;
const STAR2 = 4.0;
const STAR3 = 6.5;

function istParts(timestamp: string): { date: string; hour: number; minute: number } {
  const d = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

function sessionKey(c: RawCandle): string { return istParts(c.timestamp).date; }

function isRegularSession(c: RawCandle): boolean {
  const { hour, minute } = istParts(c.timestamp);
  const total = hour * 60 + minute;
  return total >= 9 * 60 + 15 && total < 15 * 60 + 30;
}

function pivotLevels(prev: SessionOHLC): LevelSet {
  const pivot = (prev.high + prev.low + prev.close) / 3;
  return {
    yh: prev.high, yl: prev.low,
    r1: 2 * pivot - prev.low,
    r2: pivot + (prev.high - prev.low),
    r3: prev.high + 2 * (pivot - prev.low),
    s1: 2 * pivot - prev.high,
    s2: pivot - (prev.high - prev.low),
    s3: prev.low - 2 * (prev.high - pivot),
  };
}

function emaStep(closes: number[], current: number, prev: number | null): number | null {
  if (closes.length < EMA_LEN) return null;
  if (prev === null) return closes.slice(-EMA_LEN).reduce((a, b) => a + b, 0) / EMA_LEN;
  const k = 2 / (EMA_LEN + 1);
  return current * k + prev * (1 - k);
}

function atrStep(trValues: number[], tr: number, prev: number | null): number | null {
  if (trValues.length < ATR_LEN) return null;
  if (prev === null) return trValues.slice(-ATR_LEN).reduce((a, b) => a + b, 0) / ATR_LEN;
  return ((prev * (ATR_LEN - 1)) + tr) / ATR_LEN;
}

function volumeRatio(volumes: number[], current: number): number | null {
  if (volumes.length < VOL_LEN) return null;
  const avg = volumes.slice(-VOL_LEN).reduce((a, b) => a + b, 0) / VOL_LEN;
  return avg > 0 ? current / avg : null;
}

function stars(ratio: number): 1 | 2 | 3 | 0 {
  if (ratio >= STAR3) return 3;
  if (ratio >= STAR2) return 2;
  if (ratio >= STAR1) return 1;
  return 0;
}

function levelNameForBreakout(c: RawCandle, levels: LevelSet, direction: "BUY" | "SELL"): string {
  if (direction === "BUY") {
    if (c.close >= levels.r3) return "R3";
    if (c.close >= levels.r2) return "R2";
    if (c.close >= levels.r1) return "R1";
    return "YH";
  }
  if (c.close <= levels.s3) return "S3";
  if (c.close <= levels.s2) return "S2";
  if (c.close <= levels.s1) return "S1";
  return "YL";
}

function nearestSupport(low: number, levels: LevelSet, tol: number): string | null {
  const ordered: [string, number][] = [["S3", levels.s3], ["S2", levels.s2], ["S1", levels.s1], ["YL", levels.yl]];
  for (const [name, value] of ordered) if (Math.abs(low - value) <= tol) return name;
  return null;
}

function nearestResistance(high: number, levels: LevelSet, tol: number): string | null {
  const ordered: [string, number][] = [["R3", levels.r3], ["R2", levels.r2], ["R1", levels.r1], ["YH", levels.yh]];
  for (const [name, value] of ordered) if (Math.abs(high - value) <= tol) return name;
  return null;
}

/** Replay the Pine setup logic and return the first qualifying signal of the latest session. */
export function findHistoricalPrimeSignal(input: RawCandle[]): HistoricalPrimeSignal | null {
  const candles = input.filter(isRegularSession).slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  if (candles.length < Math.max(EMA_LEN, ATR_LEN, VOL_LEN) + 2) return null;

  const sessions = new Map<string, RawCandle[]>();
  for (const c of candles) {
    const key = sessionKey(c);
    const arr = sessions.get(key) ?? [];
    arr.push(c);
    sessions.set(key, arr);
  }
  const dates = [...sessions.keys()].sort();
  if (dates.length < 2) return null;
  const latestSessionDate = dates[dates.length - 1];

  const previousSession = new Map<string, SessionOHLC>();
  for (let i = 1; i < dates.length; i++) {
    const prev = sessions.get(dates[i - 1])!;
    previousSession.set(dates[i], {
      open: prev[0].open,
      high: Math.max(...prev.map(c => c.high)),
      low: Math.min(...prev.map(c => c.low)),
      close: prev[prev.length - 1].close,
    });
  }

  let ema: number | null = null;
  let atr: number | null = null;
  let prevEma: number | null = null;
  let prevClose: number | null = null;
  const closes: number[] = [];
  const volumes: number[] = [];
  const trValues: number[] = [];
  let firstSignalLatestSession: HistoricalPrimeSignal | null = null;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const sessionDate = sessionKey(c);
    const session = previousSession.get(sessionDate);
    const range = c.high - c.low;
    const tr = prevClose === null ? range : Math.max(range, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));

    trValues.push(tr);
    closes.push(c.close);
    volumes.push(c.volume);

    const nextEma = emaStep(closes, c.close, ema);
    prevEma = ema;
    ema = nextEma;
    atr = atrStep(trValues, tr, atr);

    if (!session || ema === null || atr === null || volumes.length < VOL_LEN) {
      prevClose = c.close;
      continue;
    }

    const levels = pivotLevels(session);
    const levelTol = atr * LEVEL_TOL_ATR;
    const volRatio = volumeRatio(volumes, c.volume);
    if (volRatio === null) { prevClose = c.close; continue; }

    const volStars = stars(volRatio);
    const volConfirmed = volStars >= 1;
    const closePosition = range > 0 ? (c.close - c.low) / range : 0.5;
    const bullish = c.close > c.open;
    const bearish = c.close < c.open;
    const strongBull = bullish && closePosition >= 0.75;
    const strongBear = bearish && closePosition <= 0.25;
    const emaRising = prevEma !== null && ema > prevEma;
    const emaFalling = prevEma !== null && ema < prevEma;
    const emaLong = c.close > ema && emaRising;
    const emaShort = c.close < ema && emaFalling;
    const crossed = prevEma !== null && ((prevClose! <= prevEma && c.close > ema) || (prevClose! >= prevEma && c.close < ema));
    const emaChoppy = crossed && Math.abs(c.close - ema) < atr * LEVEL_TOL_ATR;

    const nearSupport = nearestSupport(c.low, levels, levelTol);
    const nearResistance = nearestResistance(c.high, levels, levelTol);
    const nextResAbove = c.close < levels.yh ? levels.yh : c.close < levels.r1 ? levels.r1 : c.close < levels.r2 ? levels.r2 : levels.r3;
    const nextSupBelow = c.close > levels.yl ? levels.yl : c.close > levels.s1 ? levels.s1 : c.close > levels.s2 ? levels.s2 : levels.s3;
    const roomToBuy = (nextResAbove - c.close) > atr * ROOM_ATR;
    const roomToSell = (c.close - nextSupBelow) > atr * ROOM_ATR;

    const buyBounce = !!nearSupport && strongBull && volConfirmed && emaLong && roomToBuy && !emaChoppy;
    const buyBreakout = (c.close > levels.yh || c.close > levels.r1 || c.close > levels.r2 || c.close > levels.r3) && strongBull && volConfirmed && emaLong && roomToBuy && !emaChoppy;
    const sellRejection = !!nearResistance && strongBear && volConfirmed && emaShort && roomToSell && !emaChoppy;
    const sellBreakdown = (c.close < levels.yl || c.close < levels.s1 || c.close < levels.s2 || c.close < levels.s3) && strongBear && volConfirmed && emaShort && roomToSell && !emaChoppy;

    const setupBuy = buyBounce || buyBreakout;
    const setupSell = sellRejection || sellBreakdown;

    if (sessionDate === latestSessionDate && (setupBuy || setupSell)) {
      const direction = setupBuy ? "BUY" : "SELL";
      const setup = setupBuy ? (buyBreakout ? "BREAKOUT" : "BOUNCE") : (sellBreakdown ? "BREAKDOWN" : "REJECTION");
      const level = setup === "BOUNCE" ? (nearSupport ?? "SUPPORT") : setup === "REJECTION" ? (nearResistance ?? "RESISTANCE") : levelNameForBreakout(c, levels, direction);
      const sl = setupBuy
        ? Math.min(levels.yl, levels.s1, i > 0 ? candles[i - 1].low : c.low) - atr * SL_BUFFER_ATR
        : Math.max(levels.yh, levels.r1, i > 0 ? candles[i - 1].high : c.high) + atr * SL_BUFFER_ATR;
      const risk = Math.abs(c.close - sl);
      firstSignalLatestSession = {
        direction, setup, level,
        triggerPrice: Number(c.close.toFixed(2)),
        signalTimestamp: c.timestamp,
        ema20: Number(ema.toFixed(2)),
        emaTrend: emaRising ? "RISING" : "FALLING",
        volumeRatio: Number(volRatio.toFixed(2)),
        volumeStars: volStars as 1 | 2 | 3,
        atr14: Number(atr.toFixed(2)),
        sl: Number(sl.toFixed(2)),
        riskPerShare: Number(risk.toFixed(2)),
      };
      break;
    }

    prevClose = c.close;
  }

  return firstSignalLatestSession;
}
