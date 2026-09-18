/**
 * AI chat — Supabase Edge Function.
 *
 * Sibling of `coach`, and deliberately a separate function rather than a mode
 * of it: the two have opposite contracts. `coach` sends anonymous findings and
 * forbids the model from producing any number. This one sends real trades and
 * lets the model quote the figures it was given.
 *
 * What still never leaves the device (enforced again here, not just client
 * side): entry/exit prices, stop and target levels, position sizes, account
 * balances, screenshots, free-text notes, and any identifier. See
 * src/features/chat/buildChatContext.ts for the reasoning.
 *
 * The arithmetic rule is unchanged and is the important one: every statistic
 * in `stats` is computed on the device. The model is told, in the system
 * prompt and by the shape of the payload, to quote those and never to
 * recompute. A chat that reports a win rate contradicting the dashboard would
 * make both untrustworthy.
 */

const OPENAI_MODEL = 'gpt-4o-mini';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

/** Hard ceiling on a conversation, to bound both tokens and payload size. */
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 1200;
const MAX_TRADES = 60;

const SYSTEM_PROMPT = `You are a trading coach having a conversation with a trader about their own journal.

You receive a JSON context: precomputed statistics ("stats"), a window of recent trades ("trades"), and optionally the trade the user is asking about ("focusTradeN").

Hard rules:
- NEVER compute a statistic yourself. Every aggregate figure you state must be copied from "stats". If a figure the user asks for is not in "stats", say you cannot see it rather than deriving it — your arithmetic would contradict the app's own numbers.
- You MAY quote per-trade values that are present in "trades" (pnl, r, session, pair...), and you may count or compare them qualitatively ("most of your losses are in the New York session").
- Never invent a trade, a date, or a figure that is not in the context.
- You receive an "account" block when the trader has one active account selected: its name, and derived risk figures (daily loss limit remaining, whether the session is locked, progress toward the profit target, drawdown consumed, best single day). Quote these when answering "how am I doing on my account", "can I still trade today", or challenge-status questions.
- If "account" is null, the context aggregates several accounts together: say so when relevant, never present combined figures as one account's.
- "excursions" appears when the broker recorded price excursions (MAE/MFE) for enough closed trades — typically auto-synced accounts ("isAutoAccount"). These are the most honest execution signals you have: "stoppedThroughNoise" counts trades whose adverse excursion reached a full stop distance (stops placed inside the noise), "avgCaptureRatio" is how much of the best excursion was actually banked (low = gave winners back), "avgMfeR" how far the average trade ran, "runners2R" how often 2R was on the table. Coach on them concretely; if "measured" is small, say the sample is thin.
- If "excursions" is null, execution quality cannot be assessed from this journal — never invent it.
- You still do not see prices, stop levels, position sizes or the raw balance. If asked, say so plainly.
- No market predictions, no financial advice, no opinion on whether an instrument will move.
- Be direct and specific. Refer to trades by their number ("trade 4"). Prefer one concrete observation over three hedged ones.
- Answer in the language given by "locale".
- Keep answers under 180 words unless the user explicitly asks for more.

When the trader has very few trades, say what can honestly be said about them and avoid statistical claims a small sample cannot support.`;

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

const num = (x: unknown): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : null;

const str = (x: unknown, max = 40): string | null =>
  typeof x === 'string' && x.length > 0 ? x.slice(0, max) : null;

/**
 * Rebuilds the context field by field.
 *
 * An Edge Function is a public HTTP endpoint, and this one forwards user data
 * to a third party. Whitelisting here means a future client bug — or a
 * hand-crafted request — cannot start leaking fields this contract never
 * intended to send.
 */
function sanitizeContext(input: unknown): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null) return null;
  const c = input as Record<string, unknown>;
  // v2 adds the derived account block (limits, lock, progress); v1 clients
  // are gone with the release that shipped v2, but both are accepted so a
  // stale bundle cannot brick the chat.
  if (c.v !== 1 && c.v !== 2) return null;

  const s = (c.stats ?? {}) as Record<string, unknown>;
  const stats = {
    trades: num(s.trades) ?? 0,
    wins: num(s.wins) ?? 0,
    losses: num(s.losses) ?? 0,
    breakeven: num(s.breakeven) ?? 0,
    winRatePct: num(s.winRatePct),
    netPnl: num(s.netPnl),
    grossWin: num(s.grossWin),
    grossLoss: num(s.grossLoss),
    profitFactor: num(s.profitFactor),
    avgR: num(s.avgR),
    expectancy: num(s.expectancy),
    bestTrade: num(s.bestTrade),
    worstTrade: num(s.worstTrade),
    maxDrawdown: num(s.maxDrawdown),
    currency: str(s.currency, 8) ?? 'USD',
  };

  const rawTrades = Array.isArray(c.trades) ? c.trades : [];
  const trades = rawTrades.slice(0, MAX_TRADES).map((t, i) => {
    const r = (t ?? {}) as Record<string, unknown>;
    return {
      n: num(r.n) ?? i + 1,
      pair: str(r.pair, 16) ?? '',
      dir: r.dir === 'SELL' ? 'SELL' : 'BUY',
      date: str(r.date, 10),
      hour: num(r.hour),
      weekday: num(r.weekday),
      pnl: num(r.pnl) ?? 0,
      r: num(r.r),
      outcome: str(r.outcome, 8),
      result: str(r.result, 12),
      timeframe: str(r.timeframe, 8),
      session: str(r.session, 20),
      mental: str(r.mental, 20),
      tags: Array.isArray(r.tags)
        ? r.tags.filter(x => typeof x === 'string').slice(0, 6).map(x => String(x).slice(0, 24))
        : [],
      heldMinutes: num(r.heldMinutes),
    };
  });

  // The v2 account block: derived risk figures only. Name and type are
  // capped strings, every number is bounded, and nothing here is not
  // already displayed on the dashboard.
  let accountBlock: Record<string, unknown> | null = null;
  if (c.account && typeof c.account === 'object') {
    const a = c.account as Record<string, unknown>;
    const pct = (x: unknown): number | null => {
      const v = num(x);
      return v !== null && v >= 0 && v <= 1 ? Math.round(v * 100) / 100 : null;
    };
    accountBlock = {
      name: str(a.name, 32) ?? 'Account',
      type: str(a.type, 24),
      currency: str(a.currency, 8) ?? 'USD',
      todayPnl: num(a.todayPnl) ?? 0,
      dailyLossLimit: num(a.dailyLossLimit),
      dailyRemaining: num(a.dailyRemaining),
      isLocked: a.isLocked === true,
      profitTargetProgress: pct(a.profitTargetProgress),
      drawdownUsedPct: pct(a.drawdownUsedPct),
      bestDayPnl: num(a.bestDayPnl),
    };
  }

  // The excursions block: precomputed R-conversions of the broker's MAE/MFE.
  // Counted fields are clamped to sane integers, ratios bounded — same
  // whitelist discipline as everything else.
  let excursionsBlock: Record<string, unknown> | null = null;
  if (c.excursions && typeof c.excursions === 'object') {
    const e = c.excursions as Record<string, unknown>;
    const int0 = (x: unknown): number | null => {
      const v = num(x);
      return v !== null && v >= 0 && v < 100000 ? Math.round(v) : null;
    };
    const ratio = (x: unknown): number | null => {
      const v = num(x);
      return v !== null && v >= 0 && v <= 50 ? v : null;
    };
    excursionsBlock = {
      measured: int0(e.measured) ?? 0,
      stoppedThroughNoise: int0(e.stoppedThroughNoise) ?? 0,
      runners2R: int0(e.runners2R) ?? 0,
      avgCaptureRatio: ratio(e.avgCaptureRatio),
      avgMfeR: num(e.avgMfeR) !== null ? Math.min(50, Math.max(-50, num(e.avgMfeR)!)) : null,
    };
  }

  return {
    locale: str(c.locale, 8) ?? 'fr',
    accountType: str(c.accountType, 24),
    stats,
    trades,
    focusTradeN: num(c.focusTradeN),
    account: accountBlock,
    excursions: excursionsBlock,
    isAutoAccount: c.isAutoAccount === true,
  };
}

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

function sanitizeHistory(input: unknown): ChatTurn[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_HISTORY)
    .map(m => {
      const r = (m ?? {}) as Record<string, unknown>;
      const text = typeof r.text === 'string' ? r.text.slice(0, MAX_MESSAGE_CHARS) : '';
      if (!text) return null;
      return { role: r.role === 'model' ? 'model' : 'user', text } as ChatTurn;
    })
    .filter((x): x is ChatTurn => x !== null);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const useGemini = Boolean(geminiKey);
  const apiKey = geminiKey || openaiKey;
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  // Presence check only; the gateway verifies the token (verify_jwt = true).
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const context = sanitizeContext(body.context);
  const history = sanitizeHistory(body.history);
  const message =
    typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : '';

  if (!context || !message) return json({ error: 'bad_request' }, 400);

  /**
   * The context rides as the first user turn rather than inside the system
   * prompt: it changes every message, and keeping the system prompt stable
   * makes the model's rules easier to reason about.
   */
  const contents = [
    {
      role: 'user',
      parts: [{ text: `Journal context (JSON):\n${JSON.stringify(context)}` }],
    },
    {
      role: 'model',
      parts: [{ text: 'Understood. I have the journal context and will quote its figures.' }],
    },
    ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  // See coach/index.ts: 3.x uses thinkingLevel, 2.5 uses thinkingBudget, and
  // sending the wrong one degrades or rejects the call.
  const thinkingConfigFor = (model: string): Record<string, unknown> | null => {
    if (/gemini-3/.test(model)) return { thinkingLevel: 'low' };
    if (/gemini-2\.5/.test(model)) return { thinkingBudget: 512 };
    return null;
  };

  const geminiBody = (model: string) => {
    const thinkingConfig = thinkingConfigFor(model);
    return JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        // Plain text, not JSON: this is prose for a human to read.
        // 2048 leaves room for the thinking phase, which is billed against
        // this budget on 3.x and otherwise swallows the answer entirely.
        maxOutputTokens: 2048,
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });
  };

  const callOnce = (model: string) =>
    useGemini
      ? fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
            body: geminiBody(model),
          }
        )
      : fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            max_tokens: 700,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: `Journal context (JSON):\n${JSON.stringify(context)}`,
              },
              ...history.map(h => ({
                role: h.role === 'model' ? ('assistant' as const) : ('user' as const),
                content: h.text,
              })),
              { role: 'user', content: message },
            ],
          }),
        });

  try {
    let res = await callOnce(useGemini ? GEMINI_MODEL : OPENAI_MODEL);
    let modelUsed = useGemini ? GEMINI_MODEL : OPENAI_MODEL;

    // 503 is Google saying "busy"; one retry then the lighter model.
    if (res.status === 503 && useGemini) {
      await new Promise(r => setTimeout(r, 900));
      res = await callOnce(GEMINI_MODEL);
      if (res.status === 503 && GEMINI_MODEL !== FALLBACK_MODEL) {
        res = await callOnce(FALLBACK_MODEL);
        modelUsed = FALLBACK_MODEL;
      }
    }

    if (!res.ok) {
      let upstreamReason = '';
      try {
        const errBody = await res.clone().json();
        const raw = errBody?.error?.status || errBody?.error?.message || '';
        // Mask anything key-shaped before it can echo back to the client.
        upstreamReason = String(raw).replace(/[A-Za-z0-9_-]{30,}/g, '***').slice(0, 160);
      } catch {
        // Non-JSON error body; the status alone will do.
      }
      console.error('chat: upstream error', res.status, upstreamReason);
      if (res.status === 429) return json({ error: 'rate_limited' }, 429);
      if (res.status === 401 || res.status === 403) {
        return json({ error: 'not_configured', upstreamReason }, 503);
      }
      if (res.status === 404) {
        return json({ error: 'model_not_found', model: GEMINI_MODEL }, 502);
      }
      return json({ error: 'upstream_error', upstreamStatus: res.status, upstreamReason }, 502);
    }

    const data = await res.json();
    const reply = useGemini
      ? String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
      : String(data.choices?.[0]?.message?.content ?? '').trim();

    if (!reply) {
      const finishReason = useGemini
        ? String(data.candidates?.[0]?.finishReason ?? '')
        : '';
      console.error('chat: empty completion', finishReason);
      return json({ error: 'upstream_error', upstreamReason: finishReason }, 502);
    }

    return json({ reply: reply.slice(0, 4000), model: modelUsed });
  } catch (e) {
    console.error('chat: unexpected', e);
    return json({ error: 'upstream_error' }, 502);
  }
});
