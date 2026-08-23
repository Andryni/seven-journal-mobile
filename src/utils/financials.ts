interface CalculateRMultipleParams {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
}

export function calculateRMultiple(params: CalculateRMultipleParams): number {
  const { direction, entryPrice, exitPrice, stopLoss } = params;
  
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;
  
  const reward = direction === 'BUY'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;
    
  return Number((reward / risk).toFixed(2));
}

interface TradePnLEntry {
  pnl: number;
  exit_time: string;
}

interface ConsistencyResult {
  score: number;
  alert: boolean;
}

export function calculateConsistencyScore(trades: TradePnLEntry[]): ConsistencyResult {
  const dailyPnL: Record<string, number> = {};
  
  trades.forEach(t => {
    if (t.pnl && t.exit_time) {
      const dateStr = t.exit_time.split('T')[0];
      dailyPnL[dateStr] = (dailyPnL[dateStr] || 0) + t.pnl;
    }
  });

  const totalNetProfit = Object.values(dailyPnL).reduce((sum, val) => sum + val, 0);
  if (totalNetProfit <= 0) return { score: 0, alert: false };

  const bestDayProfit = Math.max(...Object.values(dailyPnL).map(p => Math.max(0, p)));
  const score = Number(((bestDayProfit / totalNetProfit) * 100).toFixed(2));

  return {
    score,
    alert: score > 15.00
  };
}

export interface AccuratePnLParams {
  pair: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  size: number; // lots for CFD, contracts for Futures
  isFutures?: boolean;
  futuresSize?: 'mini' | 'micro';
}

/**
 * Computes exact dollar P&L based on market type, contract specs, and price difference.
 */
export function calculateAccuratePnL(params: AccuratePnLParams): number {
  const { pair, direction, entryPrice, exitPrice, size, isFutures, futuresSize = 'mini' } = params;
  if (!entryPrice || !exitPrice || !size) return 0;

  const priceDiff = direction === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;

  if (isFutures) {
    // Standard Futures contracts specs
    const p = pair.toUpperCase();
    let tickSize = 0.25;
    let tickValue = 12.5;

    if (p === 'ES') {
      tickSize = 0.25;
      tickValue = futuresSize === 'mini' ? 12.5 : 1.25;
    } else if (p === 'NQ' || p === 'MNQ') {
      tickSize = 0.25;
      tickValue = (p === 'MNQ' || futuresSize === 'micro') ? 0.5 : 5.0;
    } else if (p === 'YM' || p === 'MYM') {
      tickSize = 1.0;
      tickValue = (p === 'MYM' || futuresSize === 'micro') ? 0.5 : 5.0;
    } else if (p === 'GC' || p === 'MGC') {
      tickSize = 0.1;
      tickValue = (p === 'MGC' || futuresSize === 'micro') ? 1.0 : 10.0;
    }

    const ticks = priceDiff / tickSize;
    return Number((ticks * tickValue * size).toFixed(2));
  }

  // CFD Instruments
  const p = pair.toUpperCase();
  if (p === 'XAUUSD' || p === 'GOLD') {
    // 1 standard lot = 100 oz ($10 per point/dollar move per lot)
    return Number((priceDiff * 100 * size).toFixed(2));
  } else if (p.includes('USD') || p.includes('EUR') || p.includes('GBP') || p.includes('JPY')) {
    // Standard Forex: 1 lot = 100,000 units (~$10 per pip)
    const pipMultiplier = (p.includes('JPY')) ? 100 : 10000;
    const pips = priceDiff * pipMultiplier;
    return Number((pips * 10 * size).toFixed(2));
  } else if (p === 'US30') {
    // US30: $1 per point per contract/lot
    return Number((priceDiff * size).toFixed(2));
  } else if (p === 'NAS100') {
    // NAS100: $20 per point per lot (or 1 lot = 20 contracts)
    return Number((priceDiff * 20 * size).toFixed(2));
  }

  // Default fallback: 1 unit per point * 100
  return Number((priceDiff * 100 * size).toFixed(2));
}
