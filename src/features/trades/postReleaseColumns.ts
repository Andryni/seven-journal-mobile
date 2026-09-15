/**
 * Columns introduced after the first release. A Supabase instance that has not
 * run the latest schema.sql rejects the whole statement with PGRST204 ("column
 * not found"), so a user who simply has not migrated yet would be unable to
 * save ANY trade -- a far worse outcome than losing the cost fields.
 *
 * We therefore retry once without them. The trade is saved; only the costs are
 * dropped, which is exactly the pre-migration behaviour.
 */
export const POST_RELEASE_COLUMNS = [
  // trades
  'commission',
  'swap',
  'mae_price',
  'mfe_price',
  // trading_accounts
  'max_trades_per_day',
  'max_consecutive_losses',
  'max_risk_per_trade_pct',
] as const;

export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  // PostgREST phrases it as "Could not find the 'commission' column of 'trades'
  // in the schema cache", Postgres as 'column "swap" does not exist'. Both are
  // matched, but only when a post-release column name is actually mentioned --
  // otherwise an unrelated "column" error would trigger a pointless retry.
  const msg = (error.message || '').toLowerCase();
  const mentionsColumn = msg.includes('column');
  const mentionsOurs = POST_RELEASE_COLUMNS.some(c => msg.includes(c));
  const looksMissing = msg.includes('does not exist') || msg.includes('not find') || msg.includes('not found');
  return mentionsColumn && looksMissing && mentionsOurs;
}

export function withoutPostReleaseColumns<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const copy: Record<string, unknown> = { ...payload };
  for (const key of POST_RELEASE_COLUMNS) delete copy[key];
  return copy as Partial<T>;
}
