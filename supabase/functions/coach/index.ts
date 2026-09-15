/**
 * AI coach — Supabase Edge Function.
 *
 * Runs server-side for one reason: the model API key. An Expo app ships its
 * JS bundle to the device, so EXPO_PUBLIC_ anything is readable by anyone who
 * installs the app. The key lives here and never reaches the client.
 *
 * Two providers are supported, chosen by whichever secret is set:
 *
 *   supabase secrets set GEMINI_API_KEY=...     (Google AI Studio, free tier)
 *   supabase secrets set OPENAI_API_KEY=...     (paid)
 *
 * Gemini is preferred when both are present. Its free tier needs no credit
 * card, which matters for a request the user fires by hand a few times a week
 * -- this endpoint is nowhere near any published rate limit at that volume.
 *
 * Contract with the app (see src/features/insights/buildCoachPayload.ts):
 * the client sends findings the local engine already computed, plus coarse
 * ratios. No trades, prices, timestamps, instruments, notes, or balances.
 *
 * The model's job is narrow: turn findings into prose and prioritise them.
 * It is explicitly forbidden from producing numbers, because a model asked to
 * compute a win rate will confidently invent one, and a trading journal that
 * reports invented statistics is worse than no journal. Every figure the user
 * sees comes from computeInsights, on the device.
 */

const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Flash rather than Pro: this task is short-form rewriting of findings that
 * are already computed, and Pro models were removed from Google's free tier
 * in April 2026 while Flash kept its allowance.
 *
 * Overridable without a redeploy of the client:
 *   supabase secrets set GEMINI_MODEL=gemini-3.8-flash
 *
 * Google retires model ids on a schedule -- gemini-2.0-flash, which this
 * used to hardcode, is already discontinued, and the 2.5 family has a
 * published shutdown date. Pinning a default here while allowing an override
 * means a retirement is a one-line secret change rather than a code change.
 */
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const ALLOWED_SEVERITIES = ['critical', 'warning', 'good'];

const SYSTEM_PROMPT = `You are a trading performance coach reviewing a trader's journal statistics.

You will receive findings already computed from the trader's history. Your job:
1. Write a short briefing (max 120 words) that connects the findings into one coherent story about this trader's behaviour.
2. Name the single highest-priority change, phrased as a concrete action.

Hard rules:
- Never state a number, percentage, amount, or count. The app displays the exact figures itself; your numbers would contradict them. Refer to magnitudes in words ("most of", "a small minority").
- Never invent a finding that is not in the input.
- Do not give financial advice, market predictions, or opinions on instruments.
- Address the trader as "you". Be direct and unsentimental, not encouraging.
- Respond in the language given by the locale field.

Respond with JSON only: {"briefing": string, "priority": string}`;

interface CoachFinding {
  id: string;
  severity: string;
  impactPct: number | null;
  sampleSize: number;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/**
 * Re-validates the payload server-side. The client builds it correctly today,
 * but an Edge Function is a public HTTP endpoint: anything reaching the model
 * has to be checked here, both to reject junk and to make sure a future client
 * bug cannot start forwarding richer data than this contract allows.
 */
function sanitize(input: unknown): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null) return null;
  const p = input as Record<string, unknown>;
  if (p.v !== 1) return null;
  if (typeof p.tradesAnalysed !== 'number' || p.tradesAnalysed < 20) return null;
  if (!Array.isArray(p.findings) || p.findings.length === 0) return null;

  const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : null);

  const findings = (p.findings as CoachFinding[])
    .filter(f => f && typeof f.id === 'string' && ALLOWED_SEVERITIES.includes(f.severity))
    .slice(0, 12)
    // Rebuild each object field by field: whatever extra keys the caller sent
    // are dropped here rather than forwarded to the model.
    .map(f => ({
      id: f.id.slice(0, 40),
      severity: f.severity,
      impactPct: num(f.impactPct),
      sampleSize: num(f.sampleSize),
    }));

  if (findings.length === 0) return null;

  return {
    locale: typeof p.locale === 'string' ? p.locale.slice(0, 8) : 'en',
    tradesAnalysed: p.tradesAnalysed,
    winRate: num(p.winRate),
    avgR: num(p.avgR),
    planAdherence: num(p.planAdherence),
    profitFactor: num(p.profitFactor),
    findings,
  };
}

/** Strips digits from model output, enforcing the "no numbers" rule. */
function stripNumbers(text: string): string {
  return text.replace(/\d[\d.,]*\s*%?/g, '').replace(/\s{2,}/g, ' ').trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Gemini first: its free tier means a deployment can work without a card.
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const useGemini = Boolean(geminiKey);
  const apiKey = geminiKey || openaiKey;
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  /**
   * Second line of defence only.
   *
   * This checks that a bearer token was SENT, not that it is valid -- the
   * gateway does the real verification, because supabase/config.toml leaves
   * verify_jwt at its default of true for this function. Do not turn that off
   * on the assumption that this check covers it: any caller can send
   * `Authorization: Bearer x` and would then reach the model.
   */
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  let payload: Record<string, unknown> | null;
  try {
    payload = sanitize(await req.json());
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!payload) return json({ error: 'bad_request' }, 400);

  try {
    const res = useGemini
      ? await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // Gemini has no system role: the instructions go in
              // systemInstruction, which it treats with the same weight.
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 400,
                // Guarantees parseable output instead of prose wrapped in
                // a markdown fence, which is what a plain prompt returns.
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    briefing: { type: 'STRING' },
                    priority: { type: 'STRING' },
                  },
                  required: ['briefing', 'priority'],
                },
              },
            }),
          }
        )
      : await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.4,
            max_tokens: 400,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify(payload) },
            ],
          }),
        });

    if (!res.ok) {
      /**
       * The upstream BODY is never forwarded -- it can carry key or org
       * details. But the status code and the provider's short reason are
       * safe, and without them a failure here is undiagnosable: the app could
       * only say "it failed", and the CLI has no `functions logs` command to
       * fall back on.
       */
      let upstreamReason = '';
      try {
        const errBody = await res.clone().json();
        const raw = errBody?.error?.status || errBody?.error?.message || '';
        // Truncated and stripped of anything that could echo the key back.
        upstreamReason = String(raw).replace(/[A-Za-z0-9_-]{30,}/g, '***').slice(0, 160);
      } catch {
        // Non-JSON error body; the status alone will have to do.
      }
      console.error('coach: upstream error', res.status, upstreamReason);
      // 429 is the one the user can act on: the free tier has a daily cap,
      // and "try again later" is true and useful, unlike a generic failure.
      if (res.status === 429) return json({ error: 'rate_limited' }, 429);
      // 401/403 means the stored key is wrong, revoked, or not an API key at
      // all (a short-lived OAuth token pasted in by mistake is the common
      // case). That is a deployment fault, not a transient one, so it maps to
      // the same message as a missing key rather than "try again".
      if (res.status === 401 || res.status === 403) {
        return json({ error: 'not_configured', upstreamReason }, 503);
      }
      if (res.status === 404) {
        // The model id no longer exists. Google retires them on a schedule,
        // and this is fixed with a secret, not a code change -- so say which
        // id was tried.
        return json({ error: 'model_not_found', model: GEMINI_MODEL }, 502);
      }
      return json(
        { error: 'upstream_error', upstreamStatus: res.status, upstreamReason },
        502
      );
    }

    const data = await res.json();
    const raw = useGemini
      ? data.candidates?.[0]?.content?.parts?.[0]?.text
      : data.choices?.[0]?.message?.content;
    if (!raw) return json({ error: 'upstream_error' }, 502);

    let parsed: { briefing?: unknown; priority?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: 'upstream_error' }, 502);
    }

    const briefing = typeof parsed.briefing === 'string' ? parsed.briefing : '';
    const priority = typeof parsed.priority === 'string' ? parsed.priority : '';
    if (!briefing) return json({ error: 'upstream_error' }, 502);

    return json({
      // Belt and braces: the prompt forbids numbers, and we strip any that
      // slip through, so model output can never contradict the app's figures.
      briefing: stripNumbers(briefing).slice(0, 900),
      priority: stripNumbers(priority).slice(0, 300),
      model: useGemini ? GEMINI_MODEL : OPENAI_MODEL,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('coach: unexpected', e);
    return json({ error: 'upstream_error' }, 502);
  }
});
