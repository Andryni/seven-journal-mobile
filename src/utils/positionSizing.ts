/**
 * Position sizing — shared risk engine.
 *
 * Previously this math lived inside PositionCalculator.tsx, which meant the
 * trade form could not reuse it: a trader had to compute a size in one place
 * and retype it in another. Extracted here so sizing is risk-first everywhere
 * and can be unit-tested.
 *
 * The engine is market-aware. A position size is not a number, it is a number
 * *and a unit*, and the unit changes what is tradable:
 *
 *   CFD     → lots, fractional down to 0.01
 *   Futures → contracts, WHOLE numbers only (0.37 contracts does not exist)
 *   Crypto  → units of the coin, fractional down to 0.0001
 *
 * Everything is expressed in ticks (the instrument's minimum price increment)
 * and tick value (what one tick is worth for one unit of size). "Pip" was the
 * old CFD-only vocabulary; a futures trader does not think in pips.
 */

export type MarketType = 'CFD' | 'Futures' | 'Crypto';

/** How a position is counted for a given market. */
export type SizeUnit = 'lot' | 'contract' | 'unit';

export interface InstrumentSpec {
  market: MarketType;
  /** Minimum price increment. */
  tick: number;
  /** Currency value of one tick for one unit of size (1 lot / 1 contract / 1 coin). */
  tickValue: number;
  /** Smallest tradable size increment. Futures are integers, so 1. */
  step: number;
  unit: SizeUnit;
  label: string;
}

/**
 * Instrument catalogue — the single source of truth for contract specs.
 *
 * A duplicate of this table once lived in PositionCalculator and silently
 * drifted (XAUUSD tick 0.01 vs 0.1), producing lot sizes off by 10x between
 * two screens of the same app. Never redeclare instrument specs locally.
 */
export const INSTRUMENTS: Record<string, InstrumentSpec> = {
  // ---- CFD / spot FX: size in lots (100k units for FX majors) ----
  XAUUSD: { market: 'CFD', tick: 0.1, tickValue: 10, step: 0.01, unit: 'lot', label: 'XAUUSD (Gold)' },
  EURUSD: { market: 'CFD', tick: 0.0001, tickValue: 10, step: 0.01, unit: 'lot', label: 'EURUSD' },
  GBPUSD: { market: 'CFD', tick: 0.0001, tickValue: 10, step: 0.01, unit: 'lot', label: 'GBPUSD' },
  // JPY pairs: one pip on 1 lot is 1000 JPY, i.e. ~$6.7 at 150 USDJPY. We use a
  // fixed approximation rather than a live rate — sizing must work offline, and
  // a few percent of error on the quote currency is far less dangerous than the
  // 100x error of treating 1000 JPY as 1000 USD (which the old table did).
  USDJPY: { market: 'CFD', tick: 0.01, tickValue: 6.7, step: 0.01, unit: 'lot', label: 'USDJPY' },
  GBPJPY: { market: 'CFD', tick: 0.01, tickValue: 6.7, step: 0.01, unit: 'lot', label: 'GBPJPY' },
  US30: { market: 'CFD', tick: 1, tickValue: 1, step: 0.01, unit: 'lot', label: 'US30 (Dow CFD)' },
  NAS100: { market: 'CFD', tick: 0.25, tickValue: 5, step: 0.01, unit: 'lot', label: 'NAS100 (Nasdaq CFD)' },

  // ---- CME futures: size in whole contracts ----
  ES: { market: 'Futures', tick: 0.25, tickValue: 12.5, step: 1, unit: 'contract', label: 'ES (E-mini S&P 500)' },
  MES: { market: 'Futures', tick: 0.25, tickValue: 1.25, step: 1, unit: 'contract', label: 'MES (Micro S&P 500)' },
  NQ: { market: 'Futures', tick: 0.25, tickValue: 5, step: 1, unit: 'contract', label: 'NQ (E-mini Nasdaq 100)' },
  MNQ: { market: 'Futures', tick: 0.25, tickValue: 0.5, step: 1, unit: 'contract', label: 'MNQ (Micro Nasdaq 100)' },
  YM: { market: 'Futures', tick: 1, tickValue: 5, step: 1, unit: 'contract', label: 'YM (E-mini Dow)' },
  MYM: { market: 'Futures', tick: 1, tickValue: 0.5, step: 1, unit: 'contract', label: 'MYM (Micro Dow)' },
  RTY: { market: 'Futures', tick: 0.1, tickValue: 5, step: 1, unit: 'contract', label: 'RTY (E-mini Russell)' },
  M2K: { market: 'Futures', tick: 0.1, tickValue: 0.5, step: 1, unit: 'contract', label: 'M2K (Micro Russell)' },
  GC: { market: 'Futures', tick: 0.1, tickValue: 10, step: 1, unit: 'contract', label: 'GC (Gold futures)' },
  MGC: { market: 'Futures', tick: 0.1, tickValue: 1, step: 1, unit: 'contract', label: 'MGC (Micro Gold)' },
  CL: { market: 'Futures', tick: 0.01, tickValue: 10, step: 1, unit: 'contract', label: 'CL (Crude Oil)' },
  MCL: { market: 'Futures', tick: 0.01, tickValue: 1, step: 1, unit: 'contract', label: 'MCL (Micro Crude)' },
  '6E': { market: 'Futures', tick: 0.00005, tickValue: 6.25, step: 1, unit: 'contract', label: '6E (Euro FX)' },

  // ---- Crypto spot: size in coins, deeply fractional ----
  BTCUSD: { market: 'Crypto', tick: 0.01, tickValue: 0.01, step: 0.0001, unit: 'unit', label: 'BTC/USD' },
  ETHUSD: { market: 'Crypto', tick: 0.01, tickValue: 0.01, step: 0.001, unit: 'unit', label: 'ETH/USD' },
  SOLUSD: { market: 'Crypto', tick: 0.01, tickValue: 0.01, step: 0.01, unit: 'unit', label: 'SOL/USD' },
};

export const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS);

export const MARKET_TYPES: MarketType[] = ['CFD', 'Futures', 'Crypto'];

/** Instruments tradable on a given market, for filtering pickers per account. */
/**
 * Instruments a futures account offers in the pickers.
 *
 * The catalogue carries specs for more contracts than this (YM/MYM, RTY/M2K,
 * CL/MCL, 6E) so an imported fill on any of them is still priced correctly.
 * But a picker is a decision, not a catalogue: these six -- the S&P, Nasdaq
 * and gold contracts in both full and micro size -- are what the account
 * actually trades, and a list of thirteen made the common choice slower.
 *
 * Widen this list, do not delete it: dropping the specs would silently
 * mis-price any historical trade on the others.
 */
const FUTURES_PICKER = ['ES', 'MES', 'NQ', 'MNQ', 'GC', 'MGC'];

export function instrumentsForMarket(market: MarketType | null | undefined): string[] {
  if (!market) return INSTRUMENT_KEYS;
  if (market === 'Futures') {
    return FUTURES_PICKER.filter(k => INSTRUMENTS[k]);
  }
  return INSTRUMENT_KEYS.filter(k => INSTRUMENTS[k].market === market);
}

/** Default instrument to preselect when an account's market changes. */
export function defaultInstrumentFor(market: MarketType | null | undefined): string {
  return instrumentsForMarket(market)[0] ?? INSTRUMENT_KEYS[0];
}

/** The unit a market counts positions in — 'lot', 'contract' or 'unit'. */
export function unitForMarket(market: MarketType | null | undefined): SizeUnit {
  if (market === 'Futures') return 'contract';
  if (market === 'Crypto') return 'unit';
  return 'lot';
}

/** Decimal places appropriate for displaying a size on this market. */
export function sizeDecimals(unit: SizeUnit): number {
  if (unit === 'contract') return 0;
  if (unit === 'unit') return 4;
  return 2;
}

/** Formats a size with the precision its unit deserves. */
export function formatSize(size: number, unit: SizeUnit): string {
  const formatted = size.toFixed(sizeDecimals(unit));
  // Trim trailing zeros on fractional crypto sizes: 0.5000 reads as noise.
  return unit === 'unit' ? formatted.replace(/\.?0+$/, '') : formatted;
}

export interface SizingInput {
  instrument: string;
  balance: number;
  /** Either a percentage of balance or an absolute currency amount. */
  riskType: 'percent' | 'usd';
  riskValue: number;
  entryPrice: number;
  stopLoss: number;
}

export interface SizingResult {
  /**
   * Tradable size, floored to the instrument's step. Null when inputs are
   * incomplete or when the risk budget cannot afford one minimum increment.
   */
  size: number | null;
  /** What `size` is counted in, so callers never have to guess the noun. */
  unit: SizeUnit;
  /** The risk budget the trader asked for. */
  riskAmount: number | null;
  /**
   * What the *rounded* size actually loses at the stop. Always <= riskAmount.
   * Futures rounding can push this well below budget, and the trader needs to
   * see the real number rather than the intended one.
   */
  actualRisk: number | null;
  /** Stop distance expressed in ticks. */
  stopTicks: number | null;
  /** Value of one tick for one unit of size. */
  tickValue: number | null;
  /**
   * True when the exact size is positive but smaller than one tradable step —
   * i.e. even the minimum position risks more than the budget. On futures this
   * is common and must be surfaced, not silently rounded up to 1 contract.
   */
  belowMinimum: boolean;
}

const empty = (unit: SizeUnit = 'lot', belowMinimum = false): SizingResult => ({
  size: null,
  unit,
  riskAmount: null,
  actualRisk: null,
  stopTicks: null,
  tickValue: null,
  belowMinimum,
});

/** Floors to a step without binary-float dust (0.1+0.2 problems). */
function floorToStep(value: number, step: number): number {
  const steps = Math.floor(value / step + 1e-9);
  return Math.round(steps * step * 1e8) / 1e8;
}

export function calculatePositionSize(input: SizingInput): SizingResult {
  const { instrument, balance, riskType, riskValue, entryPrice, stopLoss } = input;
  const spec = INSTRUMENTS[instrument];

  if (
    !spec ||
    !isFinite(entryPrice) ||
    !isFinite(stopLoss) ||
    entryPrice <= 0 ||
    stopLoss <= 0 ||
    entryPrice === stopLoss ||
    riskValue <= 0 ||
    balance <= 0
  ) {
    return empty(spec?.unit);
  }

  const riskAmount = riskType === 'percent' ? balance * (riskValue / 100) : riskValue;
  const stopTicks = Math.abs(entryPrice - stopLoss) / spec.tick;
  const riskPerUnit = stopTicks * spec.tickValue;

  if (stopTicks <= 0 || riskPerUnit <= 0) return empty(spec.unit);

  const exactSize = riskAmount / riskPerUnit;
  const size = floorToStep(exactSize, spec.step);

  // Flooring is deliberate: rounding to nearest would let the position exceed
  // the stated risk budget, which is the one thing a risk engine must not do.
  if (size < spec.step) {
    return {
      ...empty(spec.unit, true),
      riskAmount: Math.round(riskAmount * 100) / 100,
      stopTicks: Math.round(stopTicks * 10) / 10,
      tickValue: spec.tickValue,
    };
  }

  return {
    size,
    unit: spec.unit,
    riskAmount: Math.round(riskAmount * 100) / 100,
    actualRisk: Math.round(size * riskPerUnit * 100) / 100,
    stopTicks: Math.round(stopTicks * 10) / 10,
    tickValue: spec.tickValue,
    belowMinimum: false,
  };
}

/**
 * Planned R:R from entry / stop / target. Independent of position size —
 * this is the quality of the setup, not of the bet.
 */
export function calculatePlannedRR(
  direction: 'BUY' | 'SELL',
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): number | null {
  if (!entryPrice || !stopLoss || !takeProfit) return null;
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return null;
  const reward = direction === 'BUY' ? takeProfit - entryPrice : entryPrice - takeProfit;
  return Math.round((reward / risk) * 100) / 100;
}

/**
 * Loss incurred at the stop for a given size — used by the pre-trade guard to
 * check the trade against the remaining daily allowance.
 */
export function estimateRiskAtStop(
  instrument: string,
  size: number,
  entryPrice: number,
  stopLoss: number
): number | null {
  const spec = INSTRUMENTS[instrument];
  if (!spec || !size || !entryPrice || !stopLoss || entryPrice === stopLoss) return null;
  const stopTicks = Math.abs(entryPrice - stopLoss) / spec.tick;
  return Math.round(stopTicks * spec.tickValue * size * 100) / 100;
}

/**
 * Currency P&L for a favourable price move of `priceMove` on `size` units.
 *
 * Unknown instruments fall back to a 1:1 tick so a custom symbol still yields
 * a plausible number rather than zero.
 */
export function estimatePnl(instrument: string, size: number, priceMove: number): number {
  const spec = INSTRUMENTS[instrument];
  if (!spec) return priceMove * size;
  return (priceMove / spec.tick) * spec.tickValue * size;
}
