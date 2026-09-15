/**
 * AI coach — Supabase Edge Function.
 *
 * Runs server-side for one reason: the model API key. An Expo app ships its
 * JS bundle to the device, so EXPO_PUBLIC_ anything is readable by anyone who
 * installs the app. The key lives here, set with
 * `supabase secrets set OPENAI_API_KEY=...`, and never reaches the client.
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

const MODEL = 'gpt-4o-mini';
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

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  // Require the caller's Supabase JWT. Without this the endpoint is an open
  // proxy to a paid model API.
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
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
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
      // Never forward the upstream body: it can contain key or org details.
      console.error('coach: upstream error', res.status);
      return json({ error: 'upstream_error' }, 502);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
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
      model: MODEL,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('coach: unexpected', e);
    return json({ error: 'upstream_error' }, 502);
  }
});
