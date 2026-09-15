// MT4/MT5 and TradingView import parsers.
//
// Parsing is now RFC 4180 compliant (see utils/csv): the previous
// `line.split(',')` corrupted every row containing a quoted comma, shifting
// prices into the size column and importing wrong-but-plausible numbers.
// Numbers also go through parseLooseNumber, because broker exports localise
// their decimals and parseFloat('1,234.56') silently yields 1.

import { parseCsvRecords, csvEscape, parseLooseNumber } from './csv';
import { inferExitReason } from './tradeOutcome';

export interface ParsedImportTrade {
  pair: string;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number | null;
  /** 0 means "unknown" — the source file did not contain a stop loss. Never fabricated. */
  stop_loss: number;
  /** 0 means "unknown" — the source file did not contain a take profit. Never fabricated. */
  take_profit: number;
  size: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  /** Positive magnitudes. 0 = the report carried no cost for this trade. */
  commission: number;
  swap: number;
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
      // The two fields between close price and profit are commission and swap
      // in the MT4/MT5 statement layout. They were matched with `.*?,.*?,` and
      // thrown away, so every imported book looked cost-free.
      /^(\d+),([\d\.\s:\-]+),(buy|sell),([\d\.]+),([A-Za-z0-9]+),([\d\.]+),([\d\.]+),([\d\.]+),([\d\.\s:\-]+),([\d\.]+),([\d\.\-]*),([\d\.\-]*),\s*([\d\.\-]+)/i,
    );
    if (match) {
      const [, , openTime, type, size, item, openPrice, sl, tp, closeTime, closePrice, commissionRaw, swapRaw, profit] = match;
      const pnl = parseFloat(profit);
      // Brokers write commission as a negative ("-7.00"); we store magnitudes.
      const commission = Math.abs(parseFloat(commissionRaw) || 0);
      const swap = Math.abs(parseFloat(swapRaw) || 0);
      const entryP = parseFloat(openPrice);
      const slP = parseFloat(sl);
      const tpP = parseFloat(tp);
      const exitP = parseFloat(closePrice);
      const direction = type.toUpperCase() === 'BUY' ? 'BUY' : 'SELL';

      // Exit reason from PRICES, not from the P&L sign. Labelling every
      // profitable close "TP" claimed the target was hit when the trade may
      // have been closed manually well short of it -- which inflated the
      // apparent hit rate of every setup in the playbook.
      const inferred = inferExitReason({
        direction,
        entryPrice: entryP,
        exitPrice: Number.isFinite(exitP) ? exitP : null,
        stopLoss: Number.isFinite(slP) ? slP : null,
        takeProfit: Number.isFinite(tpP) ? tpP : null,
        closed: !!closeTime,
      });
      // The DB check constraint only allows TP/SL/BE/OPEN, and forcing a new
      // enum value would break imports on any instance that has not run the
      // latest schema. So BE doubles as "closed for neither target nor stop".
      // This is a labelling compromise only: the real P&L and R-multiple are
      // stored untouched, and every statistic classifies by P&L sign, so no
      // number is affected -- unlike the old mapping, which claimed a target
      // had been hit whenever a trade merely closed green.
      const result: 'TP' | 'SL' | 'BE' | 'OPEN' =
        inferred === 'MANUAL' ? 'BE' : inferred;

      // R-multiple is only computed when the report actually contains a stop loss.
      // We never fabricate risk data — unknown stays null and is excluded from analytics.
      let rMultiple: number | null = null;
      if (slP > 0 && Math.abs(entryP - slP) > 0 && exitP > 0) {
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
        stop_loss: slP || 0,
        take_profit: tpP || 0,
        size: parseFloat(size),
        entry_time: new Date(openTime.replace(/\./g, '-')).toISOString(),
        exit_time: closeTime
          ? new Date(closeTime.replace(/\./g, '-')).toISOString()
          : null,
        pnl: isNaN(pnl) ? null : pnl,
        commission,
        swap,
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
  const records = parseCsvRecords(content);
  const trades: ParsedImportTrade[] = [];

  const pick = (row: Record<string, string>, ...keys: string[]): string => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== '') return v;
    }
    return '';
  };

  for (const row of records) {
    const symbol = pick(row, 'symbol', 'ticker', 'instrument') || 'XAUUSD';
    const type = (pick(row, 'type', 'action', 'side') || 'BUY').toUpperCase();
    const direction = type.includes('SELL') || type.includes('SHORT') ? 'SELL' : 'BUY';

    const entryP = parseLooseNumber(pick(row, 'entry price', 'price', 'open'));
    const exitP = parseLooseNumber(pick(row, 'exit price', 'close price', 'close'));
    const pnl = parseLooseNumber(pick(row, 'profit', 'pnl', 'net profit'));
    const size = parseLooseNumber(pick(row, 'contracts', 'size', 'qty')) ?? 1;

    const dateStr = pick(row, 'date/time', 'time', 'date');
    const exitDateStr = pick(row, 'exit time', 'close time', 'exit date');

    // A row without a usable entry price is not a trade; skipping it is the
    // only honest option, and the caller reports the count.
    if (entryP === null || entryP <= 0) continue;

    const parsedEntry = dateStr ? new Date(dateStr) : new Date();
    const parsedExit = exitDateStr ? new Date(exitDateStr) : null;

    // TradingView exports carry no SL/TP, so stop_loss/take_profit stay 0
    // (unknown) and r_multiple stays null rather than being fabricated --
    // otherwise avg R and expectancy would be computed from invented risk.
    trades.push({
      pair: symbol.toUpperCase().replace('.P', '').replace('-', ''),
      direction,
      entry_price: entryP,
      exit_price: exitP && exitP > 0 ? exitP : null,
      stop_loss: 0,
      take_profit: 0,
      size: size > 0 ? size : 1,
      entry_time: (isNaN(parsedEntry.getTime()) ? new Date() : parsedEntry).toISOString(),
      exit_time: parsedExit && !isNaN(parsedExit.getTime()) ? parsedExit.toISOString() : null,
      pnl,
      // TradingView exports carry no cost columns. 0 means "not recorded",
      // which the cost summary reports as such instead of implying free trades.
      commission: 0,
      swap: 0,
      r_multiple: null,
      // TradingView exports carry no SL/TP, so there is no evidence a target
      // or a stop was ever reached. Claiming 'TP' on every green row invented
      // that evidence. Closed rows are recorded as 'BE' -- "closed, reason
      // unknown" -- and the P&L, which drives every statistic, is untouched.
      result: pnl === null ? 'OPEN' : 'BE',
      notes: 'Imported from TradingView',
    });
  }

  return trades;
}

/**
 * Génère un CSV à partir d'une liste de trades.
 */
export function generateTradeCSV(trades: Trade[]): string {
  const headers = [
    'EntryTime',
    'Instrument',
    'Direction',
    'Size',
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
    // ISO date: locale-formatted dates do not survive a round-trip through
    // an importer, and this file is meant to be re-importable.
    new Date(t.entry_time).toISOString(),
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
    t.notes || '',
  ]);
  // Every field is escaped: a note containing a comma used to corrupt the
  // column alignment of the exported file.
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ].join('\n');
}

// Re-export Trade type for convenience
import type { Trade } from '../types/domain';
