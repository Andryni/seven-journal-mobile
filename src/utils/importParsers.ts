// Parseurs d'import MT4/MT5 et TradingView pour mobile
// Adapté depuis le projet web

export interface ParsedImportTrade {
  pair: string;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number | null;
  stop_loss: number;
  take_profit: number;
  size: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  r_multiple: number | null;
  result: 'TP' | 'SL' | 'BE' | 'OPEN';
  timeframe?: 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';
  notes?: string;
}

/**
 * Parse un rapport MT4/MT5 (CSV ou HTML) en trades structurés.
 */
export function parseMT4MT5Report(content: string): ParsedImportTrade[] {
  const trades: ParsedImportTrade[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line) => {
    const match = line.match(
      /^(\d+),([\d\.\s:\-]+),(buy|sell),([\d\.]+),([A-Za-z0-9]+),([\d\.]+),([\d\.]+),([\d\.]+),([\d\.\s:\-]+),([\d\.]+),.*?,.*?,\s*([\d\.\-]+)/i,
    );
    if (match) {
      const [, , openTime, type, size, item, openPrice, sl, tp, closeTime, closePrice, profit] = match;
      const pnl = parseFloat(profit);
      const entryP = parseFloat(openPrice);
      const slP = parseFloat(sl);
      const tpP = parseFloat(tp);
      const exitP = parseFloat(closePrice);
      const direction = type.toUpperCase() === 'BUY' ? 'BUY' : 'SELL';

      let result: 'TP' | 'SL' | 'BE' | 'OPEN' = 'OPEN';
      if (pnl > 0) result = 'TP';
      else if (pnl < 0) result = 'SL';
      else if (closeTime) result = 'BE';

      let rMultiple: number | null = null;
      if (slP > 0 && Math.abs(entryP - slP) > 0) {
        const slDist = Math.abs(entryP - slP);
        rMultiple = parseFloat(
          ((exitP - entryP) / (direction === 'BUY' ? slDist : -slDist)).toFixed(2),
        );
      }

      trades.push({
        pair: item.toUpperCase().replace('/', ''),
        direction,
        entry_price: entryP,
        exit_price: exitP || null,
        stop_loss: slP || (direction === 'BUY' ? entryP * 0.99 : entryP * 1.01),
        take_profit: tpP || (direction === 'BUY' ? entryP * 1.02 : entryP * 0.98),
        size: parseFloat(size),
        entry_time: new Date(openTime.replace(/\./g, '-')).toISOString(),
        exit_time: closeTime
          ? new Date(closeTime.replace(/\./g, '-')).toISOString()
          : null,
        pnl: isNaN(pnl) ? null : pnl,
        r_multiple: rMultiple,
        result,
        notes: `Importé via MT4/MT5 (${openTime})`,
      });
    }
  });

  return trades;
}

/**
 * Parse un export CSV TradingView en trades structurés.
 */
export function parseTradingViewExport(content: string): ParsedImportTrade[] {
  const trades: ParsedImportTrade[] = [];
  const lines = content.split(/\r?\n/);

  if (lines.length < 2) return trades;
  const headers = lines[0].toLowerCase().split(',');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });

    const symbol = row['symbol'] || row['ticker'] || row['instrument'] || 'XAUUSD';
    const type = (row['type'] || row['action'] || row['side'] || 'BUY').toUpperCase();
    const direction = type.includes('SELL') || type.includes('SHORT') ? 'SELL' : 'BUY';
    const entryP = parseFloat(row['entry price'] || row['price'] || row['open'] || '0');
    const exitP = parseFloat(row['exit price'] || row['close price'] || row['close'] || '0');
    const pnl = parseFloat(row['profit'] || row['pnl'] || row['net profit'] || '0');
    const size = parseFloat(row['contracts'] || row['size'] || row['qty'] || '1.0');
    const dateStr = row['date/time'] || row['time'] || row['date'] || new Date().toISOString();

    if (entryP > 0) {
      trades.push({
        pair: symbol.toUpperCase().replace('.P', '').replace('-', ''),
        direction,
        entry_price: entryP,
        exit_price: exitP || null,
        stop_loss: direction === 'BUY' ? entryP * 0.99 : entryP * 1.01,
        take_profit: direction === 'BUY' ? entryP * 1.02 : entryP * 0.98,
        size,
        entry_time: new Date(dateStr).toISOString(),
        exit_time: exitP ? new Date().toISOString() : null,
        pnl: isNaN(pnl) ? null : pnl,
        r_multiple: pnl > 0 ? 1.5 : -1,
        result: pnl > 0 ? 'TP' : pnl < 0 ? 'SL' : 'BE',
        notes: 'Importé via TradingView',
      });
    }
  }

  return trades;
}

/**
 * Génère un CSV à partir d'une liste de trades.
 */
export function generateTradeCSV(trades: Trade[]): string {
  const headers = [
    'Date',
    'Instrument',
    'Direction',
    'Lots',
    'Timeframe',
    'Entry',
    'SL',
    'TP',
    'Exit',
    'Result',
    'PnL',
    'R-Multiple',
    'Mental State',
    'Notes',
  ];
  const rows = trades.map((t) => [
    new Date(t.entry_time).toLocaleDateString('fr-FR'),
    t.pair,
    t.direction,
    String(t.size),
    t.timeframe,
    String(t.entry_price),
    String(t.stop_loss),
    String(t.take_profit),
    t.exit_price != null ? String(t.exit_price) : '',
    t.result,
    t.pnl != null ? String(t.pnl) : '',
    t.r_multiple != null ? String(t.r_multiple) : '',
    t.mental_state,
    `"${(t.notes || '').replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// Re-export Trade type for convenience
import type { Trade } from '../types/domain';
