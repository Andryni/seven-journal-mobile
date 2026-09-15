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
  | 'not_deployed'
  | 'model_not_found'
  | 'unauthorized'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export function useCoach(trades: Trade[], locale: string, playbookTitles: string[] = []) {
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CoachError | null>(null);
  /**
   * The provider's own words, when it gave any.
   *
   * Shown under the error message because the Supabase CLI has no
   * `functions logs` command -- without this the only way to find out why a
   * call failed is to guess.
   */
  const [detail, setDetail] = useState<string | null>(null);

  const ask = useCallback(async () => {
    const payload = buildCoachPayload(trades, locale, playbookTitles);
    if (!payload) {
      setError('not_enough_data');
      return;
    }

    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('coach', {
        body: payload,
      });

      if (fnError) {
        /**
         * invoke() collapses any non-2xx into an error object, so the real
         * cause has to be read back off it. Without this every failure --
         * a missing secret, a retired model id, a rejected key -- surfaced as
         * "Summary unavailable. Try again later", which is both wrong and
         * unactionable: none of those get better by waiting.
         */
        const ctx = (fnError as { context?: Response }).context;

        let code: string | null = null;
        if (ctx) {
          try {
            const body = await ctx.clone().json();
            if (typeof body?.error === 'string') code = body.error;
            if (typeof body?.upstreamReason === 'string' && body.upstreamReason) {
              setDetail(body.upstreamReason);
            }
            if (body?.error === 'model_not_found') {
              // Name a model that works, not the one that does not.
              setDetail(
                body.suggestion
                  ? `${body.model} → ${body.suggestion}`
                  : String(body.model ?? '')
              );
            }
          } catch {
            // Non-JSON body; fall back to the status code below.
          }
        }

        if (code === 'model_not_found') {
          setError('model_not_found');
          return;
        }

        if (code === 'rate_limited' || ctx?.status === 429) {
          setError('rate_limited');
          return;
        }
        if (code === 'not_configured' || ctx?.status === 503) {
          setError('not_configured');
          return;
        }
        if (ctx?.status === 401 || ctx?.status === 403) {
          // The function itself refused us: the user's session is stale.
          setError('unauthorized');
          return;
        }
        if (ctx?.status === 404) {
          // The function is not deployed under this name.
          setError('not_deployed');
          return;
        }
        if (ctx) {
          // Reached the server, which failed: not a connectivity problem.
          console.warn('coach: upstream failed', ctx.status, code);
          setError('unknown');
          return;
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
    setDetail(null);
  }, []);

  return { result, loading, error, detail, ask, reset };
}
