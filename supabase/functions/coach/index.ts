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
 * A numbered id, not an alias -- and this is a live-tested choice, not a
 * guess. gemini-2.5-flash, the previous default, was retired in September
 * 2026 but KEPT APPEARING in the model catalogue, so `diagnose` looked fine
 * while every generateContent 404ed. The `gemini-flash-latest` alias was
 * tried as a replacement and currently resolves to a preview model that
 * answers 503 UNAVAILABLE far more often than the GA one. Google's own
 * migration guide for the 2.5 shutdown names gemini-3.8-flash.
 *
 * When this id is eventually retired too, the 404 path below asks Google
 * for a live replacement and the fix is one secret -- no redeploy:
 *   supabase secrets set GEMINI_MODEL=<suggestion-from-the-app>
 */
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
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
  /**
   * An EMPTY findings array is valid: a disciplined book with no behavioural
   * leak triggers no rule, and the aggregate ratios alone are enough for a
   * briefing. Only a non-array is rejected. Findings stay capped at 12.
   */
  if (!Array.isArray(p.findings)) return null;

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

  // No "findings.length === 0" rejection here: empty is the disciplined-book
  // case, valid by design (see the Array.isArray check above).

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  /**
   * Diagnostic mode: `{"diagnose": true}` asks Google which models this key
   * can actually use, instead of guessing an id and getting a 404.
   *
   * Model ids are retired on a schedule and availability varies by key and by
   * region, so no id hardcoded in this repo stays correct. Only the names are
   * returned -- no key material, no payload, and the model is never called.
   */
  if (useGemini && (body as { diagnose?: unknown })?.diagnose === true) {
    try {
      const listed = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': apiKey } }
      );
      if (!listed.ok) {
        return json({ error: 'diagnose_failed', upstreamStatus: listed.status }, 502);
      }
      const data = await listed.json();
      const models = (data.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: { name?: string }) => String(m.name ?? '').replace(/^models\//, ''))
        .filter(Boolean);
      return json({ configuredModel: GEMINI_MODEL, availableModels: models });
    } catch (e) {
      console.error('coach: diagnose failed', e);
      return json({ error: 'diagnose_failed' }, 502);
    }
  }

  const payload = sanitize(body);
  if (!payload) return json({ error: 'bad_request' }, 400);

  /**
   * The request body is identical on every attempt, so it is built once.
   * Kept as a closure rather than a top-level constant so the function stays
   * the single place that knows the payload shape.
   */
  const geminiBody = () =>
    JSON.stringify({
      // Gemini has no system role: the instructions go in
      // systemInstruction, which it treats with the same weight.
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
      generationConfig: {
        // No temperature: deprecated (then removed) on Gemini 3+ per
        // Google's own migration guide -- sending it on a 3.x model
        // is asking for a 400.
        //
        // 400 was too small and produced EMPTY answers on 3.x flash:
        // those models think before answering and the thinking tokens
        // come out of maxOutputTokens, so the budget died inside the
        // reasoning and parts[0].text arrived missing/empty. The task
        // is short but not free; 2048 leaves room for thinking plus
        // the ~200 tokens the answer actually needs.
        maxOutputTokens: 2048,
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
    });

  const openaiBody = () =>
    JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });

  /**
   * Lighter sibling used as an overload valve. gemini-3.8-flash answered
   * 503 UNAVAILABLE on ~2 calls out of 3 during an observed load spike
   * (September 2026) while gemini-3.1-flash-lite answered 3/3 with briefing
   * quality well within what this task needs. A summary delayed a few
   * seconds beats a summary that fails.
   */
  const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

  /**
   * 503 UNAVAILABLE is Google saying "model busy right now" -- observed live
   * on a stable, non-preview model, and it succeeded on the second identical
   * call seconds later. Sequence: one quiet retry of the primary after a
   * real wait, then the lighter fallback model. The user only sees a
   * failure when Google is busy for the whole ladder.
   */
  const callUpstream = async (): Promise<{ res: Response; modelUsed: string }> => {
    // The id the ladder starts from -- on the OpenAI branch that is OpenAI's
    // own model name, so modelUsed stays truthful about who answered.
    const primaryId = useGemini ? GEMINI_MODEL : OPENAI_MODEL;
    const once = (model: string) =>
      useGemini
        ? fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: geminiBody(),
            }
          )
        : fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: openaiBody(),
          });

    const first = await once(primaryId);
    if (first.status === 503) {
      await new Promise((r) => setTimeout(r, 1200));
      const second = await once(primaryId);
      if (second.status === 503 && useGemini && GEMINI_MODEL !== FALLBACK_MODEL) {
        const fallback = await once(FALLBACK_MODEL);
        return { res: fallback, modelUsed: FALLBACK_MODEL };
      }
      return { res: second, modelUsed: primaryId };
    }
    return { res: first, modelUsed: primaryId };
  };

  try {
    const { res, modelUsed } = await callUpstream();

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
        /**
         * The model id no longer exists. Rather than making the user guess a
         * replacement, ask Google what this key can use and name one.
         *
         * Not retried automatically: silently switching model would hide the
         * fact that the configured id is dead, and it would come back every
         * single call. The user sets the secret once and the problem is gone.
         */
        let suggestion = '';
        try {
          const listed = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models',
            { headers: { 'x-goog-api-key': apiKey } }
          );
          if (listed.ok) {
            const data = await listed.json();
            const usable: string[] = (data.models ?? [])
              .filter((m: { supportedGenerationMethods?: string[] }) =>
                m.supportedGenerationMethods?.includes('generateContent')
              )
              .map((m: { name?: string }) => String(m.name ?? '').replace(/^models\//, ''))
              .filter(Boolean);
            // A listed id can be the dead one itself: gemini-2.5-flash kept
            // appearing in this catalogue for weeks after generateContent
            // began 404ing, so the naive "first flash in the list" suggested
            // the corpse as its own replacement. Filter out media/specialist
            // models, previews, the dead id, and (for a numbered dead model)
            // its whole version family, which retires with it.
            const junk = /(image|tts|transcribe|omni|robotics|lyria|embedding|veo|deep-research|computer-use|antigravity|preview)/;
            const versionPrefix = /^gemini-\d/.test(GEMINI_MODEL)
              ? GEMINI_MODEL.split('-').slice(0, 2).join('-') + '-'
              : '';
            const candidates = usable.filter(
              (m) => m !== GEMINI_MODEL && !junk.test(m) && !m.startsWith(versionPrefix)
            );
            // The stable alias first: it survives the next retirement.
            suggestion =
              candidates.find((m) => m === 'gemini-flash-latest') ??
              candidates.find((m) => m.includes('flash-latest')) ??
              candidates.find((m) => m.includes('flash')) ??
              candidates[0] ??
              '';
          }
        } catch {
          // Suggestion is a convenience; the error stands without it.
        }
        return json(
          { error: 'model_not_found', model: GEMINI_MODEL, suggestion },
          502
        );
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
    if (!raw) {
      // A 200 with no text is almost always finishReason: MAX_TOKENS -- the
      // thinking budget ate the answer. Name the reason instead of failing
      // opaquely; it is a provider enum, never sensitive.
      const finishReason =
        useGemini ? String(data.candidates?.[0]?.finishReason ?? '') : '';
      console.error('coach: empty completion', finishReason);
      return json({ error: 'upstream_error', upstreamReason: finishReason }, 502);
    }

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
      // The id that ACTUALLY answered -- it can be the fallback model when
      // the primary was overloaded.
      model: modelUsed,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('coach: unexpected', e);
    return json({ error: 'upstream_error' }, 502);
  }
});
