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
