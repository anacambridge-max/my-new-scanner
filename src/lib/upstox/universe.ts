/**
 * NSE F&O Universe
 *
 * Source: NSE F&O eligible stocks.
 * This module maintains the F&O universe and resolves Upstox instrument keys.
 *
 * Upstox instrument format: NSE_EQ|ISIN or NSE_FO|ISIN
 *
 * The complete F&O universe is fetched from Upstox instruments master.
 * For sandbox/fallback, a representative static list is used.
 */

export interface FnOInstrument {
  symbol: string;
  name: string;
  isin: string;
  lotSize: number;
  instrumentKey: string; // NSE_EQ equity key
  futuresKey: string | null; // NSE_FO futures key
  series: string; // EQ
}

/**
 * Representative NSE F&O universe (static fallback).
 * In production, this should be fetched from the Upstox instruments master CSV.
 *
 * Lot sizes and ISINs are approximate — exact values come from Upstox master.
 */
export const STATIC_FNO_UNIVERSE: FnOInstrument[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", isin: "INE002A01018", lotSize: 250, instrumentKey: "NSE_EQ|INE002A01018", futuresKey: "NSE_FO|RELIANCE25JANFUT", series: "EQ" },
  { symbol: "TCS", name: "Tata Consultancy Services", isin: "INE467B01029", lotSize: 150, instrumentKey: "NSE_EQ|INE467B01029", futuresKey: "NSE_FO|TCS25JANFUT", series: "EQ" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", isin: "INE040A01034", lotSize: 550, instrumentKey: "NSE_EQ|INE040A01034", futuresKey: "NSE_FO|HDFCBANK25JANFUT", series: "EQ" },
  { symbol: "INFY", name: "Infosys Ltd", isin: "INE009A01021", lotSize: 300, instrumentKey: "NSE_EQ|INE009A01021", futuresKey: "NSE_FO|INFY25JANFUT", series: "EQ" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", isin: "INE090A01021", lotSize: 700, instrumentKey: "NSE_EQ|INE090A01021", futuresKey: "NSE_FO|ICICIBANK25JANFUT", series: "EQ" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", isin: "INE237A01028", lotSize: 400, instrumentKey: "NSE_EQ|INE237A01028", futuresKey: "NSE_FO|KOTAKBANK25JANFUT", series: "EQ" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", isin: "INE238A01034", lotSize: 625, instrumentKey: "NSE_EQ|INE238A01034", futuresKey: "NSE_FO|AXISBANK25JANFUT", series: "EQ" },
  { symbol: "SBIN", name: "State Bank of India", isin: "INE062A01020", lotSize: 1500, instrumentKey: "NSE_EQ|INE062A01020", futuresKey: "NSE_FO|SBIN25JANFUT", series: "EQ" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", isin: "INE397D01024", lotSize: 475, instrumentKey: "NSE_EQ|INE397D01024", futuresKey: "NSE_FO|BHARTIARTL25JANFUT", series: "EQ" },
  { symbol: "WIPRO", name: "Wipro Ltd", isin: "INE075A01022", lotSize: 1500, instrumentKey: "NSE_EQ|INE075A01022", futuresKey: "NSE_FO|WIPRO25JANFUT", series: "EQ" },
  { symbol: "LT", name: "Larsen & Toubro", isin: "INE018A01030", lotSize: 150, instrumentKey: "NSE_EQ|INE018A01030", futuresKey: "NSE_FO|LT25JANFUT", series: "EQ" },
  { symbol: "HCLTECH", name: "HCL Technologies", isin: "INE860A01027", lotSize: 700, instrumentKey: "NSE_EQ|INE860A01027", futuresKey: "NSE_FO|HCLTECH25JANFUT", series: "EQ" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd", isin: "INE021A01026", lotSize: 300, instrumentKey: "NSE_EQ|INE021A01026", futuresKey: "NSE_FO|ASIANPAINT25JANFUT", series: "EQ" },
  { symbol: "MARUTI", name: "Maruti Suzuki India", isin: "INE585B01010", lotSize: 50, instrumentKey: "NSE_EQ|INE585B01010", futuresKey: "NSE_FO|MARUTI25JANFUT", series: "EQ" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", isin: "INE296A01024", lotSize: 125, instrumentKey: "NSE_EQ|INE296A01024", futuresKey: "NSE_FO|BAJFINANCE25JANFUT", series: "EQ" },
  { symbol: "TITAN", name: "Titan Company", isin: "INE280A01028", lotSize: 375, instrumentKey: "NSE_EQ|INE280A01028", futuresKey: "NSE_FO|TITAN25JANFUT", series: "EQ" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", isin: "INE044A01036", lotSize: 350, instrumentKey: "NSE_EQ|INE044A01036", futuresKey: "NSE_FO|SUNPHARMA25JANFUT", series: "EQ" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", isin: "INE481G01011", lotSize: 100, instrumentKey: "NSE_EQ|INE481G01011", futuresKey: "NSE_FO|ULTRACEMCO25JANFUT", series: "EQ" },
  { symbol: "NESTLEIND", name: "Nestle India", isin: "INE239A01016", lotSize: 50, instrumentKey: "NSE_EQ|INE239A01016", futuresKey: "NSE_FO|NESTLEIND25JANFUT", series: "EQ" },
  { symbol: "POWERGRID", name: "Power Grid Corporation", isin: "INE752E01010", lotSize: 3000, instrumentKey: "NSE_EQ|INE752E01010", futuresKey: "NSE_FO|POWERGRID25JANFUT", series: "EQ" },
  { symbol: "NTPC", name: "NTPC Ltd", isin: "INE733E01010", lotSize: 3000, instrumentKey: "NSE_EQ|INE733E01010", futuresKey: "NSE_FO|NTPC25JANFUT", series: "EQ" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp", isin: "INE213A01029", lotSize: 1925, instrumentKey: "NSE_EQ|INE213A01029", futuresKey: "NSE_FO|ONGC25JANFUT", series: "EQ" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", isin: "INE081A01012", lotSize: 5500, instrumentKey: "NSE_EQ|INE081A01012", futuresKey: "NSE_FO|TATASTEEL25JANFUT", series: "EQ" },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd", isin: "INE019A01038", lotSize: 600, instrumentKey: "NSE_EQ|INE019A01038", futuresKey: "NSE_FO|JSWSTEEL25JANFUT", series: "EQ" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", isin: "INE030A01027", lotSize: 300, instrumentKey: "NSE_EQ|INE030A01027", futuresKey: "NSE_FO|HINDUNILVR25JANFUT", series: "EQ" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv", isin: "INE918I01026", lotSize: 500, instrumentKey: "NSE_EQ|INE918I01026", futuresKey: "NSE_FO|BAJAJFINSV25JANFUT", series: "EQ" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories", isin: "INE089A01023", lotSize: 125, instrumentKey: "NSE_EQ|INE089A01023", futuresKey: "NSE_FO|DRREDDY25JANFUT", series: "EQ" },
  { symbol: "CIPLA", name: "Cipla Ltd", isin: "INE059A01026", lotSize: 650, instrumentKey: "NSE_EQ|INE059A01026", futuresKey: "NSE_FO|CIPLA25JANFUT", series: "EQ" },
  { symbol: "EICHERMOT", name: "Eicher Motors", isin: "INE066A01021", lotSize: 175, instrumentKey: "NSE_EQ|INE066A01021", futuresKey: "NSE_FO|EICHERMOT25JANFUT", series: "EQ" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp", isin: "INE158A01026", lotSize: 150, instrumentKey: "NSE_EQ|INE158A01026", futuresKey: "NSE_FO|HEROMOTOCO25JANFUT", series: "EQ" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals", isin: "INE437A01024", lotSize: 125, instrumentKey: "NSE_EQ|INE437A01024", futuresKey: "NSE_FO|APOLLOHOSP25JANFUT", series: "EQ" },
  { symbol: "ADANIENT", name: "Adani Enterprises", isin: "INE423A01024", lotSize: 250, instrumentKey: "NSE_EQ|INE423A01024", futuresKey: "NSE_FO|ADANIENT25JANFUT", series: "EQ" },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ", isin: "INE742F01042", lotSize: 625, instrumentKey: "NSE_EQ|INE742F01042", futuresKey: "NSE_FO|ADANIPORTS25JANFUT", series: "EQ" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products", isin: "INE192A01025", lotSize: 450, instrumentKey: "NSE_EQ|INE192A01025", futuresKey: "NSE_FO|TATACONSUM25JANFUT", series: "EQ" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories", isin: "INE361B01024", lotSize: 200, instrumentKey: "NSE_EQ|INE361B01024", futuresKey: "NSE_FO|DIVISLAB25JANFUT", series: "EQ" },
  { symbol: "TECHM", name: "Tech Mahindra", isin: "INE669C01036", lotSize: 600, instrumentKey: "NSE_EQ|INE669C01036", futuresKey: "NSE_FO|TECHM25JANFUT", series: "EQ" },
  { symbol: "COALINDIA", name: "Coal India Ltd", isin: "INE522F01014", lotSize: 4200, instrumentKey: "NSE_EQ|INE522F01014", futuresKey: "NSE_FO|COALINDIA25JANFUT", series: "EQ" },
  { symbol: "BPCL", name: "Bharat Petroleum Corp", isin: "INE029A01011", lotSize: 1800, instrumentKey: "NSE_EQ|INE029A01011", futuresKey: "NSE_FO|BPCL25JANFUT", series: "EQ" },
  { symbol: "IOC", name: "Indian Oil Corporation", isin: "INE242A01010", lotSize: 7500, instrumentKey: "NSE_EQ|INE242A01010", futuresKey: "NSE_FO|IOC25JANFUT", series: "EQ" },
  { symbol: "HINDALCO", name: "Hindalco Industries", isin: "INE038A01020", lotSize: 1400, instrumentKey: "NSE_EQ|INE038A01020", futuresKey: "NSE_FO|HINDALCO25JANFUT", series: "EQ" },
  { symbol: "GRASIM", name: "Grasim Industries", isin: "INE047A01021", lotSize: 475, instrumentKey: "NSE_EQ|INE047A01021", futuresKey: "NSE_FO|GRASIM25JANFUT", series: "EQ" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank", isin: "INE095A01012", lotSize: 500, instrumentKey: "NSE_EQ|INE095A01012", futuresKey: "NSE_FO|INDUSINDBK25JANFUT", series: "EQ" },
  { symbol: "M&M", name: "Mahindra & Mahindra", isin: "INE101A01026", lotSize: 350, instrumentKey: "NSE_EQ|INE101A01026", futuresKey: "NSE_FO|M&M25JANFUT", series: "EQ" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", isin: "INE155A01022", lotSize: 2325, instrumentKey: "NSE_EQ|INE155A01022", futuresKey: "NSE_FO|TATAMOTORS25JANFUT", series: "EQ" },
  { symbol: "SHREECEM", name: "Shree Cement", isin: "INE070A01015", lotSize: 25, instrumentKey: "NSE_EQ|INE070A01015", futuresKey: "NSE_FO|SHREECEM25JANFUT", series: "EQ" },
  { symbol: "GODREJCP", name: "Godrej Consumer Products", isin: "INE102D01028", lotSize: 500, instrumentKey: "NSE_EQ|INE102D01028", futuresKey: "NSE_FO|GODREJCP25JANFUT", series: "EQ" },
  { symbol: "PIDILITIND", name: "Pidilite Industries", isin: "INE318A01026", lotSize: 500, instrumentKey: "NSE_EQ|INE318A01026", futuresKey: "NSE_FO|PIDILITIND25JANFUT", series: "EQ" },
  { symbol: "MCDOWELL-N", name: "United Spirits Ltd", isin: "INE854D01024", lotSize: 625, instrumentKey: "NSE_EQ|INE854D01024", futuresKey: "NSE_FO|MCDOWELL-N25JANFUT", series: "EQ" },
  { symbol: "BOSCHLTD", name: "Bosch Ltd", isin: "INE323A01026", lotSize: 25, instrumentKey: "NSE_EQ|INE323A01026", futuresKey: "NSE_FO|BOSCHLTD25JANFUT", series: "EQ" },
  { symbol: "BANKBARODA", name: "Bank of Baroda", isin: "INE028A01039", lotSize: 5850, instrumentKey: "NSE_EQ|INE028A01039", futuresKey: "NSE_FO|BANKBARODA25JANFUT", series: "EQ" },
];

export function getFnOUniverse(): FnOInstrument[] {
  return STATIC_FNO_UNIVERSE;
}

export function getFnOBySymbol(symbol: string): FnOInstrument | undefined {
  return STATIC_FNO_UNIVERSE.find(
    (i) => i.symbol.toLowerCase() === symbol.toLowerCase()
  );
}
