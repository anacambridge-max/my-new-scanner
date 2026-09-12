import { gunzipSync } from "node:zlib";

export interface FnOInstrument {
  symbol: string;
  name: string;
  isin: string;
  lotSize: number;
  instrumentKey: string;
  futuresKey: string | null;
  series: string;
}

type MasterInstrument = {
  segment?: string;
  name?: string;
  isin?: string;
  instrument_key?: string;
  trading_symbol?: string;
  short_name?: string;
  instrument_type?: string;
  lot_size?: number;
  expiry?: string | number;
  underlying_key?: string;
};

const NSE_MASTER_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedUniverse: FnOInstrument[] | null = null;
let cachedAt = 0;

// Emergency fallback only. Production loads the live Upstox NSE master.
export const STATIC_FNO_UNIVERSE: FnOInstrument[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", isin: "INE002A01018", lotSize: 250, instrumentKey: "NSE_EQ|INE002A01018", futuresKey: null, series: "EQ" },
  { symbol: "TCS", name: "Tata Consultancy Services", isin: "INE467B01029", lotSize: 150, instrumentKey: "NSE_EQ|INE467B01029", futuresKey: null, series: "EQ" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", isin: "INE040A01034", lotSize: 550, instrumentKey: "NSE_EQ|INE040A01034", futuresKey: null, series: "EQ" },
  { symbol: "INFY", name: "Infosys Ltd", isin: "INE009A01021", lotSize: 300, instrumentKey: "NSE_EQ|INE009A01021", futuresKey: null, series: "EQ" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", isin: "INE090A01021", lotSize: 700, instrumentKey: "NSE_EQ|INE090A01021", futuresKey: null, series: "EQ" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", isin: "INE237A01028", lotSize: 400, instrumentKey: "NSE_EQ|INE237A01028", futuresKey: null, series: "EQ" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", isin: "INE238A01034", lotSize: 625, instrumentKey: "NSE_EQ|INE238A01034", futuresKey: null, series: "EQ" },
  { symbol: "SBIN", name: "State Bank of India", isin: "INE062A01020", lotSize: 1500, instrumentKey: "NSE_EQ|INE062A01020", futuresKey: null, series: "EQ" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", isin: "INE397D01024", lotSize: 475, instrumentKey: "NSE_EQ|INE397D01024", futuresKey: null, series: "EQ" },
  { symbol: "WIPRO", name: "Wipro Ltd", isin: "INE075A01022", lotSize: 1500, instrumentKey: "NSE_EQ|INE075A01022", futuresKey: null, series: "EQ" },
  { symbol: "LT", name: "Larsen & Toubro", isin: "INE018A01030", lotSize: 150, instrumentKey: "NSE_EQ|INE018A01030", futuresKey: null, series: "EQ" },
  { symbol: "HCLTECH", name: "HCL Technologies", isin: "INE860A01027", lotSize: 700, instrumentKey: "NSE_EQ|INE860A01027", futuresKey: null, series: "EQ" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd", isin: "INE021A01026", lotSize: 300, instrumentKey: "NSE_EQ|INE021A01026", futuresKey: null, series: "EQ" },
  { symbol: "MARUTI", name: "Maruti Suzuki India", isin: "INE585B01010", lotSize: 50, instrumentKey: "NSE_EQ|INE585B01010", futuresKey: null, series: "EQ" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", isin: "INE296A01024", lotSize: 125, instrumentKey: "NSE_EQ|INE296A01024", futuresKey: null, series: "EQ" },
  { symbol: "TITAN", name: "Titan Company", isin: "INE280A01028", lotSize: 375, instrumentKey: "NSE_EQ|INE280A01028", futuresKey: null, series: "EQ" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", isin: "INE044A01036", lotSize: 350, instrumentKey: "NSE_EQ|INE044A01036", futuresKey: null, series: "EQ" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", isin: "INE481G01011", lotSize: 100, instrumentKey: "NSE_EQ|INE481G01011", futuresKey: null, series: "EQ" },
  { symbol: "NESTLEIND", name: "Nestle India", isin: "INE239A01016", lotSize: 50, instrumentKey: "NSE_EQ|INE239A01016", futuresKey: null, series: "EQ" },
  { symbol: "POWERGRID", name: "Power Grid Corporation", isin: "INE752E01010", lotSize: 3000, instrumentKey: "NSE_EQ|INE752E01010", futuresKey: null, series: "EQ" },
  { symbol: "NTPC", name: "NTPC Ltd", isin: "INE733E01010", lotSize: 3000, instrumentKey: "NSE_EQ|INE733E01010", futuresKey: null, series: "EQ" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp", isin: "INE213A01029", lotSize: 1925, instrumentKey: "NSE_EQ|INE213A01029", futuresKey: null, series: "EQ" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", isin: "INE081A01012", lotSize: 5500, instrumentKey: "NSE_EQ|INE081A01012", futuresKey: null, series: "EQ" },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd", isin: "INE019A01038", lotSize: 600, instrumentKey: "NSE_EQ|INE019A01038", futuresKey: null, series: "EQ" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", isin: "INE030A01027", lotSize: 300, instrumentKey: "NSE_EQ|INE030A01027", futuresKey: null, series: "EQ" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv", isin: "INE918I01026", lotSize: 500, instrumentKey: "NSE_EQ|INE918I01026", futuresKey: null, series: "EQ" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories", isin: "INE089A01023", lotSize: 125, instrumentKey: "NSE_EQ|INE089A01023", futuresKey: null, series: "EQ" },
  { symbol: "CIPLA", name: "Cipla Ltd", isin: "INE059A01026", lotSize: 650, instrumentKey: "NSE_EQ|INE059A01026", futuresKey: null, series: "EQ" },
  { symbol: "EICHERMOT", name: "Eicher Motors", isin: "INE066A01021", lotSize: 175, instrumentKey: "NSE_EQ|INE066A01021", futuresKey: null, series: "EQ" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp", isin: "INE158A01026", lotSize: 150, instrumentKey: "NSE_EQ|INE158A01026", futuresKey: null, series: "EQ" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals", isin: "INE437A01024", lotSize: 125, instrumentKey: "NSE_EQ|INE437A01024", futuresKey: null, series: "EQ" },
  { symbol: "ADANIENT", name: "Adani Enterprises", isin: "INE423A01024", lotSize: 250, instrumentKey: "NSE_EQ|INE423A01024", futuresKey: null, series: "EQ" },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ", isin: "INE742F01042", lotSize: 625, instrumentKey: "NSE_EQ|INE742F01042", futuresKey: null, series: "EQ" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products", isin: "INE192A01025", lotSize: 450, instrumentKey: "NSE_EQ|INE192A01025", futuresKey: null, series: "EQ" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories", isin: "INE361B01024", lotSize: 200, instrumentKey: "NSE_EQ|INE361B01024", futuresKey: null, series: "EQ" },
  { symbol: "TECHM", name: "Tech Mahindra", isin: "INE669C01036", lotSize: 600, instrumentKey: "NSE_EQ|INE669C01036", futuresKey: null, series: "EQ" },
  { symbol: "COALINDIA", name: "Coal India Ltd", isin: "INE522F01014", lotSize: 4200, instrumentKey: "NSE_EQ|INE522F01014", futuresKey: null, series: "EQ" },
  { symbol: "BPCL", name: "Bharat Petroleum Corp", isin: "INE029A01011", lotSize: 1800, instrumentKey: "NSE_EQ|INE029A01011", futuresKey: null, series: "EQ" },
  { symbol: "IOC", name: "Indian Oil Corporation", isin: "INE242A01010", lotSize: 7500, instrumentKey: "NSE_EQ|INE242A01010", futuresKey: null, series: "EQ" },
  { symbol: "HINDALCO", name: "Hindalco Industries", isin: "INE038A01020", lotSize: 1400, instrumentKey: "NSE_EQ|INE038A01020", futuresKey: null, series: "EQ" },
  { symbol: "GRASIM", name: "Grasim Industries", isin: "INE047A01021", lotSize: 475, instrumentKey: "NSE_EQ|INE047A01021", futuresKey: null, series: "EQ" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank", isin: "INE095A01012", lotSize: 500, instrumentKey: "NSE_EQ|INE095A01012", futuresKey: null, series: "EQ" },
  { symbol: "M&M", name: "Mahindra & Mahindra", isin: "INE101A01026", lotSize: 350, instrumentKey: "NSE_EQ|INE101A01026", futuresKey: null, series: "EQ" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", isin: "INE155A01022", lotSize: 2325, instrumentKey: "NSE_EQ|INE155A01022", futuresKey: null, series: "EQ" },
  { symbol: "SHREECEM", name: "Shree Cement", isin: "INE070A01015", lotSize: 25, instrumentKey: "NSE_EQ|INE070A01015", futuresKey: null, series: "EQ" },
  { symbol: "GODREJCP", name: "Godrej Consumer Products", isin: "INE102D01028", lotSize: 500, instrumentKey: "NSE_EQ|INE102D01028", futuresKey: null, series: "EQ" },
  { symbol: "PIDILITIND", name: "Pidilite Industries", isin: "INE318A01026", lotSize: 500, instrumentKey: "NSE_EQ|INE318A01026", futuresKey: null, series: "EQ" },
  { symbol: "MCDOWELL-N", name: "United Spirits Ltd", isin: "INE854D01024", lotSize: 625, instrumentKey: "NSE_EQ|INE854D01024", futuresKey: null, series: "EQ" },
  { symbol: "BOSCHLTD", name: "Bosch Ltd", isin: "INE323A01026", lotSize: 25, instrumentKey: "NSE_EQ|INE323A01026", futuresKey: null, series: "EQ" },
  { symbol: "BANKBARODA", name: "Bank of Baroda", isin: "INE028A01039", lotSize: 5850, instrumentKey: "NSE_EQ|INE028A01039", futuresKey: null, series: "EQ" },
];

function expiryTime(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return Number.POSITIVE_INFINITY;
  if (typeof value === "number") return value > 10_000_000_000 ? value : value * 1000;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

async function loadNseMaster(): Promise<MasterInstrument[]> {
  const response = await fetch(NSE_MASTER_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Upstox NSE master HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? gunzipSync(bytes).toString("utf8")
    : bytes.toString("utf8");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Invalid Upstox NSE master format");
  return parsed as MasterInstrument[];
}

function buildLiveUniverse(master: MasterInstrument[]): FnOInstrument[] {
  const now = Date.now();
  const futuresByUnderlying = new Map<string, MasterInstrument>();

  for (const item of master) {
    if (item.segment !== "NSE_FO" || item.instrument_type !== "FUT") continue;
    if (!item.underlying_key || !item.instrument_key) continue;
    const expiry = expiryTime(item.expiry);
    if (expiry !== Number.POSITIVE_INFINITY && expiry + 24 * 60 * 60 * 1000 < now) continue;
    const current = futuresByUnderlying.get(item.underlying_key);
    if (!current || expiry < expiryTime(current.expiry)) futuresByUnderlying.set(item.underlying_key, item);
  }

  const equities = new Map<string, MasterInstrument>();
  for (const item of master) {
    if (item.segment !== "NSE_EQ" || !item.instrument_key || !item.trading_symbol || !item.isin) continue;
    if (item.instrument_type && !["EQ", "BE", "BZ"].includes(item.instrument_type)) continue;
    equities.set(item.instrument_key, item);
  }

  const result: FnOInstrument[] = [];
  for (const [underlyingKey, future] of futuresByUnderlying) {
    const equity = equities.get(underlyingKey);
    if (!equity) continue;
    result.push({
      symbol: String(equity.trading_symbol),
      name: String(equity.name || equity.short_name || equity.trading_symbol),
      isin: String(equity.isin),
      lotSize: Number(future.lot_size || equity.lot_size || 1),
      instrumentKey: String(equity.instrument_key),
      futuresKey: String(future.instrument_key),
      series: String(equity.instrument_type || "EQ"),
    });
  }
  return result.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function getFnOUniverse(): Promise<FnOInstrument[]> {
  if (cachedUniverse && Date.now() - cachedAt < CACHE_TTL_MS) return cachedUniverse;
  try {
    const live = buildLiveUniverse(await loadNseMaster());
    if (live.length < 100) throw new Error(`Only ${live.length} live F&O equities resolved`);
    cachedUniverse = live;
    cachedAt = Date.now();
    console.info(`[upstox-universe] Loaded ${live.length} live NSE F&O equities`);
    return live;
  } catch (error) {
    console.warn("[upstox-universe] Live master unavailable; using fallback:", error instanceof Error ? error.message : String(error));
    return STATIC_FNO_UNIVERSE;
  }
}

export async function getFnOBySymbol(symbol: string): Promise<FnOInstrument | undefined> {
  const universe = await getFnOUniverse();
  return universe.find((i) => i.symbol.toLowerCase() === symbol.toLowerCase());
}
