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

export type CoachError = 'not_enough_data' | 'not_configured' | 'network' | 'unknown';

export function useCoach(trades: Trade[], locale: string) {
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CoachError | null>(null);

  const ask = useCallback(async () => {
    const payload = buildCoachPayload(trades, locale);
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
        setError('network');
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
  }, [trades, locale]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, ask, reset };
}
