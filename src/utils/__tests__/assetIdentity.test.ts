import { assetIdentity, shortTicker, fxBase } from '../assetIdentity';
import { INSTRUMENT_KEYS } from '../positionSizing';

describe('assetIdentity', () => {
  it('names gold by its chemical symbol on both CFD and futures', () => {
    expect(assetIdentity('XAUUSD').symbol).toBe('Au');
    expect(assetIdentity('GC').symbol).toBe('Au');
    expect(assetIdentity('MGC').symbol).toBe('Au');
    expect(assetIdentity('XAUUSD').kind).toBe('metal');
  });

  it('uses the base currency for an FX pair', () => {
    // Majors render as their currency sign: '€' is read as money at a
    // glance where 'EUR' is read as three letters.
    expect(assetIdentity('EURUSD').symbol).toBe('\u20AC');
    expect(assetIdentity('GBPJPY').symbol).toBe('\u00A3');
    expect(assetIdentity('EURUSD').kind).toBe('fx');
    // A pair with no sign in the table keeps the desk's three-letter base.
    expect(assetIdentity('AUDNZD').symbol).toBe('AUD');
  });

  it('does not mistake the metals pair for FX', () => {
    // XAUUSD is six letters like a pair; it must not resolve to 'XAU'.
    expect(assetIdentity('XAUUSD').kind).toBe('metal');
  });

  it('uses unicode signs for crypto so no image is needed', () => {
    expect(assetIdentity('BTCUSD').symbol).toBe('\u20BF');
    expect(assetIdentity('ETHUSD').symbol).toBe('\u039E');
    expect(assetIdentity('BTCUSD').kind).toBe('crypto');
  });

  it('classifies index futures and shortens their ticker', () => {
    expect(assetIdentity('NAS100').symbol).toBe('NAS');
    expect(assetIdentity('ES').kind).toBe('index');
    expect(assetIdentity('ES').symbol).toBe('ES');
  });

  it('classifies crude as energy', () => {
    expect(assetIdentity('CL').kind).toBe('energy');
    expect(assetIdentity('MCL').kind).toBe('energy');
  });

  it('flags micro contracts so they can render subordinate to the full size', () => {
    expect(assetIdentity('MES').isMicro).toBe(true);
    expect(assetIdentity('ES').isMicro).toBe(false);
    expect(assetIdentity('MNQ').isMicro).toBe(true);
  });

  it('is case and whitespace insensitive', () => {
    expect(assetIdentity(' eurusd ').symbol).toBe('\u20AC');
  });

  it('degrades gracefully on an unknown or empty symbol', () => {
    expect(assetIdentity('').symbol).toBe('?');
    expect(assetIdentity('').kind).toBe('unknown');
    const custom = assetIdentity('WHATEVER');
    expect(custom.symbol.length).toBeLessThanOrEqual(3);
  });

  it('never returns a glyph too long to fit the circle', () => {
    INSTRUMENT_KEYS.forEach(key => {
      const id = assetIdentity(key);
      expect(id.symbol.length).toBeGreaterThan(0);
      expect(id.symbol.length).toBeLessThanOrEqual(3);
    });
  });

  it('assigns a tone to every catalogued instrument', () => {
    INSTRUMENT_KEYS.forEach(key => {
      expect(assetIdentity(key).tone).toBeTruthy();
      expect(assetIdentity(key).kind).not.toBe('unknown');
    });
  });
});

describe('shortTicker', () => {
  it('keeps short tickers intact', () => {
    expect(shortTicker('ES')).toBe('ES');
    expect(shortTicker('NQ')).toBe('NQ');
  });

  it('strips the trailing digits of an index name', () => {
    expect(shortTicker('NAS100')).toBe('NAS');
    expect(shortTicker('US30')).toBe('US');
  });

  it('caps anything longer at three characters', () => {
    expect(shortTicker('VERYLONGSYMBOL').length).toBe(3);
  });
});

describe('fxBase', () => {
  it('extracts the base currency', () => {
    expect(fxBase('EURUSD')).toBe('EUR');
  });

  it('rejects anything that is not a 6-letter pair', () => {
    expect(fxBase('ES')).toBeNull();
    expect(fxBase('NAS100')).toBeNull();
  });
});
