import { useCallback, useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { buildCoachPayload } from './buildCoachPayload';
import type { Trade } from '../../types/domain';

/**
 * Calls the AI coach Edge Function.
 *
 * Deliberately manual: no fetch on mount, no refetch on data change. The
 * summary costs money per call and the underlying findings are already on
 * screen without it, so the request only happens when the user presses the
 * button. That also keeps the privacy promise legible -- nothing leaves the
 * device unless the user asked for it.
 */

export interface CoachResult {
  briefing: string;
  priority: string;
  generatedAt: string;
}

export type CoachError =
  | 'not_enough_data'
  | 'not_configured'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export function useCoach(trades: Trade[], locale: string, playbookTitles: string[] = []) {
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CoachError | null>(null);

  const ask = useCallback(async () => {
    const payload = buildCoachPayload(trades, locale, playbookTitles);
    if (!payload) {
      setError('not_enough_data');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('coach', {
        body: payload,
      });

      if (fnError) {
        // invoke() turns a non-2xx into an error, so the body has to be read
        // back off it to tell a daily-cap refusal from a dead network.
        const ctx = (fnError as { context?: Response }).context;
        if (ctx?.status === 429) {
          setError('rate_limited');
          return;
        }
        if (ctx) {
          try {
            const body = await ctx.clone().json();
            if (body?.error === 'rate_limited') {
              setError('rate_limited');
              return;
            }
            if (body?.error === 'not_configured') {
              setError('not_configured');
              return;
            }
          } catch {
            // Fall through to the generic network error.
          }
        }
        setError('network');
        return;
      }
      if (data?.error === 'rate_limited') {
        setError('rate_limited');
        return;
      }
      if (data?.error === 'not_configured') {
        // The deployment has no model key. Say so rather than showing a
        // generic failure the user cannot act on.
        setError('not_configured');
        return;
      }
      if (!data?.briefing) {
        setError('unknown');
        return;
      }

      setResult({
        briefing: data.briefing,
        priority: data.priority ?? '',
        generatedAt: data.generatedAt ?? new Date().toISOString(),
      });
    } catch {
      setError('network');
    } finally {
      setLoading(false);
    }
  }, [trades, locale, playbookTitles]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, ask, reset };
}
