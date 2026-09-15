/**
 * Position sizing — shared risk engine.
 *
 * Previously this math lived inside PositionCalculator.tsx, which meant the
 * trade form could not reuse it: a trader had to compute a size in one place
 * and retype it in another. Extracted here so sizing is risk-first everywhere
 * and can be unit-tested.
 */

export interface InstrumentSpec {
  /** Minimum price increment used as the "pip" for this instrument. */
  pip: number;
  /** Units per 1.00 lot. */
  contractSize: number;
  label: string;
}

export const INSTRUMENTS: Record<string, InstrumentSpec> = {
  XAUUSD: { pip: 0.1, contractSize: 100, label: 'XAUUSD (Gold)' },
  EURUSD: { pip: 0.0001, contractSize: 100000, label: 'EURUSD' },
  GBPUSD: { pip: 0.0001, contractSize: 100000, label: 'GBPUSD' },
  USDJPY: { pip: 0.01, contractSize: 100000, label: 'USDJPY' },
  US30: { pip: 1, contractSize: 1, label: 'US30 (Dow)' },
  NAS100: { pip: 0.25, contractSize: 20, label: 'NAS100 (Nasdaq)' },
  BTCUSD: { pip: 1, contractSize: 1, label: 'Bitcoin (BTC/USD)' },
};

export const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS);

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
  /** Lots, rounded to 2dp. Null when inputs are incomplete/invalid. */
  lotSize: number | null;
  /** Currency amount at risk if the stop is hit. */
  riskAmount: number | null;
  /** Stop distance expressed in pips. */
  stopPips: number | null;
  /** Value of one pip for one lot. */
  pipValue: number | null;
}

const EMPTY: SizingResult = { lotSize: null, riskAmount: null, stopPips: null, pipValue: null };

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
    return EMPTY;
  }

  const riskAmount = riskType === 'percent' ? balance * (riskValue / 100) : riskValue;
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopPips = stopDistance / spec.pip;
  const pipValue = spec.pip * spec.contractSize;

  if (stopPips <= 0 || pipValue <= 0) return EMPTY;

  const lotSize = riskAmount / (stopPips * pipValue);

  return {
    lotSize: Math.round(lotSize * 100) / 100,
    riskAmount: Math.round(riskAmount * 100) / 100,
    stopPips: Math.round(stopPips * 10) / 10,
    pipValue,
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
 * Loss incurred at the stop for a given lot size — used by the pre-trade
 * guard to check the trade against the remaining daily allowance.
 */
export function estimateRiskAtStop(
  instrument: string,
  lotSize: number,
  entryPrice: number,
  stopLoss: number
): number | null {
  const spec = INSTRUMENTS[instrument];
  if (!spec || !lotSize || !entryPrice || !stopLoss || entryPrice === stopLoss) return null;
  const stopPips = Math.abs(entryPrice - stopLoss) / spec.pip;
  const pipValue = spec.pip * spec.contractSize;
  return Math.round(stopPips * pipValue * lotSize * 100) / 100;
}
