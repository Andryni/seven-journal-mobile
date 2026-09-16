import { INSTRUMENTS } from './positionSizing';
import type { MarketType } from './positionSizing';

/**
 * Visual identity for a traded symbol — pure, so it can be unit-tested.
 *
 * Deliberately NOT bitmap logos:
 *   - CME/ICE product marks (ES, NQ, GC...) and index names are trademarks;
 *     bundling them in a published app is a real legal exposure.
 *   - An FX pair has no logo. It would have to be two national flags, which
 *     is both politically loaded and unreadable at 28px.
 *   - 23 remote images means latency, a cache to manage, and holes whenever
 *     the network drops -- in an app whose whole point is working offline.
 *
 * So the identity is typographic: the notation traders already use. Gold is
 * "Au" because that is what it is called on a desk, not a yellow coin icon.
 */

export type AssetKind = 'fx' | 'metal' | 'index' | 'energy' | 'crypto' | 'unknown';

export interface AssetIdentity {
  /** 1-3 characters drawn in the glyph. */
  symbol: string;
  kind: AssetKind;
  market: MarketType | null;
  /** Semantic colour token name, resolved against the theme by the component. */
  tone: 'amber' | 'gold' | 'cyan' | 'green' | 'blue' | 'neutral';
  /** True for reduced-size CME contracts (MES, MNQ...). */
  isMicro: boolean;
}

/** Chemical symbols: the notation a metals desk actually uses. */
const METALS: Record<string, string> = {
  XAUUSD: 'Au',
  GC: 'Au',
  MGC: 'Au',
  XAGUSD: 'Ag',
  SI: 'Ag',
};

/** Unicode currency signs, so crypto needs no image either. */
const CRYPTO: Record<string, string> = {
  BTCUSD: '\u20BF', // ₿
  ETHUSD: '\u039E', // Ξ
  SOLUSD: 'SOL',
  XRPUSD: 'XRP',
  ADAUSD: 'ADA',
  DOGEUSD: '\u00D0', // Ð
};

/**
 * Currency signs for FX majors.
 *
 * '€' reads as a currency instantly where 'EUR' reads as three letters, and
 * it is the same glyph a trader sees on every platform. Pairs outside this
 * table keep their three-letter base, which is still the desk notation.
 */
const FX_SIGNS: Record<string, string> = {
  EUR: '\u20AC', // €
  GBP: '\u00A3', // £
  JPY: '\u00A5', // ¥
  USD: '$',
  CHF: '\u20A3', // ₣
  INR: '\u20B9', // ₹
};

const ENERGY = new Set(['CL', 'MCL', 'NG', 'QM']);

/** CME micro contracts, which get a muted tone to read as derived. */
const MICROS = new Set(['MES', 'MNQ', 'MYM', 'M2K', 'MGC', 'MCL']);

/**
 * Base currency of an FX pair, used as the glyph text.
 * 'EURUSD' -> 'EUR'. Returns null when the symbol is not a 6-letter pair.
 */
export function fxBase(symbol: string): string | null {
  if (!/^[A-Z]{6}$/.test(symbol)) return null;
  // XAU/XAG are metals quoted like FX; they are handled before this.
  return symbol.slice(0, 3);
}

export function assetIdentity(symbolRaw: string): AssetIdentity {
  const symbol = (symbolRaw || '').toUpperCase().trim();
  const spec = INSTRUMENTS[symbol];
  const market = spec?.market ?? null;
  const isMicro = MICROS.has(symbol);

  if (METALS[symbol]) {
    return { symbol: METALS[symbol], kind: 'metal', market, tone: 'gold', isMicro };
  }

  if (CRYPTO[symbol]) {
    return { symbol: CRYPTO[symbol], kind: 'crypto', market, tone: 'cyan', isMicro };
  }

  if (ENERGY.has(symbol)) {
    return { symbol, kind: 'energy', market, tone: 'amber', isMicro };
  }

  // FX before indices: a 6-letter all-alpha symbol is a currency pair.
  const base = fxBase(symbol);
  if (base && market !== 'Futures') {
    return { symbol: FX_SIGNS[base] ?? base, kind: 'fx', market, tone: 'blue', isMicro };
  }

  if (market === 'Futures' || /^(US30|NAS100|SPX500|GER40|UK100|6E)$/.test(symbol)) {
    return { symbol: shortTicker(symbol), kind: 'index', market, tone: 'amber', isMicro };
  }

  if (!symbol) {
    return { symbol: '?', kind: 'unknown', market: null, tone: 'neutral', isMicro: false };
  }

  return { symbol: shortTicker(symbol), kind: 'unknown', market, tone: 'neutral', isMicro };
}

/**
 * Longest readable form of a ticker inside a small circle.
 *
 * 'NAS100' at 3 characters is 'NAS', which is still unambiguous; keeping all
 * six would render as unreadable 6px type.
 */
export function shortTicker(symbol: string): string {
  if (symbol.length <= 3) return symbol;
  const stripped = symbol.replace(/[0-9]+$/, '');
  return (stripped.length >= 2 ? stripped : symbol).slice(0, 3);
}
