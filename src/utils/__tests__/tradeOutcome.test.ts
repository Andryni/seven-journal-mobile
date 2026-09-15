import {
  inferExitReason,
  classifyPnl,
  isOutcomeInconsistent,
  outcomeVariant,
} from '../tradeOutcome';

describe('inferExitReason', () => {
  const buy = {
    direction: 'BUY' as const,
    entryPrice: 2000,
    stopLoss: 1990,
    takeProfit: 2020,
    closed: true,
  };

  it('reports OPEN when the position is not closed', () => {
    expect(inferExitReason({ ...buy, closed: false, exitPrice: null })).toBe('OPEN');
    expect(inferExitReason({ ...buy, closed: true, exitPrice: null })).toBe('OPEN');
  });

  it('reports TP only when price actually reached the target', () => {
    expect(inferExitReason({ ...buy, exitPrice: 2020 })).toBe('TP');
    expect(inferExitReason({ ...buy, exitPrice: 2025 })).toBe('TP');
  });

  it('reports SL when price reached the stop', () => {
    expect(inferExitReason({ ...buy, exitPrice: 1990 })).toBe('SL');
    expect(inferExitReason({ ...buy, exitPrice: 1985 })).toBe('SL');
  });

  it('does NOT call a profitable manual exit a TP', () => {
    // This is the reported bug: +1R banked below the target is not a TP.
    expect(inferExitReason({ ...buy, exitPrice: 2010 })).toBe('MANUAL');
  });

  it('reports BE for an exit at the entry price', () => {
    expect(inferExitReason({ ...buy, exitPrice: 2000 })).toBe('BE');
  });

  it('handles SELL direction symmetrically', () => {
    const sell = {
      direction: 'SELL' as const,
      entryPrice: 2000,
      stopLoss: 2010,
      takeProfit: 1980,
      closed: true,
    };
    expect(inferExitReason({ ...sell, exitPrice: 1980 })).toBe('TP');
    expect(inferExitReason({ ...sell, exitPrice: 2010 })).toBe('SL');
    expect(inferExitReason({ ...sell, exitPrice: 1990 })).toBe('MANUAL');
    expect(inferExitReason({ ...sell, exitPrice: 2000 })).toBe('BE');
  });

  it('absorbs slippage just past the target', () => {
    // Stop distance 10, tolerance 2% => 0.2. A fill at 2019.9 still counts.
    expect(inferExitReason({ ...buy, exitPrice: 2019.9 })).toBe('TP');
  });

  it('falls back to MANUAL when there is no stop or target', () => {
    expect(
      inferExitReason({
        direction: 'BUY',
        entryPrice: 2000,
        exitPrice: 2050,
        stopLoss: null,
        takeProfit: null,
        closed: true,
      })
    ).toBe('MANUAL');
  });

  it('still detects breakeven without a stop loss', () => {
    expect(
      inferExitReason({
        direction: 'BUY',
        entryPrice: 2000,
        exitPrice: 2000,
        stopLoss: null,
        takeProfit: null,
        closed: true,
      })
    ).toBe('BE');
  });
});

describe('classifyPnl', () => {
  it('separates win, loss, flat and open', () => {
    expect(classifyPnl(120)).toBe('win');
    expect(classifyPnl(-40)).toBe('loss');
    expect(classifyPnl(0)).toBe('flat');
    expect(classifyPnl(null)).toBe('open');
    expect(classifyPnl(undefined)).toBe('open');
  });

  it('treats a non-finite value as open rather than flat', () => {
    expect(classifyPnl(NaN)).toBe('open');
  });
});

describe('isOutcomeInconsistent', () => {
  it('accepts a breakeven exit that earned money', () => {
    // Partials or a trailed stop: legitimate, must not be flagged or rewritten.
    expect(isOutcomeInconsistent('BE', 85)).toBe(false);
    expect(isOutcomeInconsistent('BE', -12)).toBe(false);
  });

  it('flags a TP that lost money', () => {
    expect(isOutcomeInconsistent('TP', -50)).toBe(true);
  });

  it('flags an SL that made money', () => {
    expect(isOutcomeInconsistent('SL', 30)).toBe(true);
  });

  it('accepts consistent pairings', () => {
    expect(isOutcomeInconsistent('TP', 200)).toBe(false);
    expect(isOutcomeInconsistent('SL', -100)).toBe(false);
  });

  it('flags a closed-looking result with no P&L', () => {
    expect(isOutcomeInconsistent('TP', null)).toBe(true);
    expect(isOutcomeInconsistent('OPEN', null)).toBe(false);
  });
});

describe('outcomeVariant', () => {
  it('colours by money, not by the label', () => {
    // A BE exit at +1R must read as a win, not as neutral grey.
    expect(outcomeVariant({ result: 'BE', pnl: 150 })).toBe('green');
    expect(outcomeVariant({ result: 'BE', pnl: -20 })).toBe('red');
    expect(outcomeVariant({ result: 'BE', pnl: 0 })).toBe('neutral');
  });

  it('keeps open trades neutral', () => {
    expect(outcomeVariant({ result: 'OPEN', pnl: null })).toBe('neutral');
  });
});
