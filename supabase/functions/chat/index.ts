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
- You may PROPOSE one action at the very end of your reply, and only when the user clearly asked for a change. Format, on its own final line: <<<ACTION{"kind":"add_tag","tradeNs":[3,7],"tag":"revenge"}>>>  — kinds are "add_tag" (needs "tag"), "set_mental_state" (needs "mentalState", one of focused/anxious/greedy/revenge/fomo/tired), "filter_trades", "set_r_multiple", "set_costs" and "request_broker_fill" (the last three take no fields; EVERY named trade must be flagged "rFillable" — respectively "costsFillable", "excursionsFillable" — in "gaps", because the app refuses a proposal that names even one non-fillable trade). Reference trades only by their number in "trades"; never invent one. Nothing is applied until the trader confirms it on screen, so describe the change in your prose as a proposal, not as done. Never propose a change to a price, a P&L, a size, or the deletion of anything — you cannot, and claiming otherwise misleads.
- "completeness" reports what the journal is MISSING. Imported trades arrive with prices but no context, and promotion has to seed mental_state and timeframe to satisfy the schema, so those values exist without meaning anything. "assessed" is the real sample size behind any mental-state claim — quote it, not "total", whenever you discuss psychology. "byField" counts how many trades lack each field, and "worstTradeNs" points at the emptiest ones by their number in "trades". Never describe a seeded value as if the trader had chosen it.
- "gaps" reports what the NUMERIC record of the sent trades is missing, trade by trade: "r" (no R-multiple stored), "stop" (no stop-loss), "target" (no take-profit), "exit" (no exit price), "costs" (commission and swap both unknown), "excursions" (no MAE/MFE) and "notes" (no note written). When the trader asks what is missing — from their trades, their imports, or a specific trade — answer from THIS block first: name the fields and the trade numbers, most damaging first (a missing R or stop distorts every risk statistic; missing costs distort net results).
- What the app CAN fill in versus what only the trader can: "rFillable" marks trades whose R-multiple can be derived on the device from their own entry, stop and exit — propose "set_r_multiple" for those. "costsFillable" marks trades whose missing commission and swap exist in the broker's own record — propose "set_costs" for those. The app supplies the numbers at confirmation in both cases; you never compute or state them. "excursionsFillable" marks bridge-sourced trades whose missing stop, target or MAE/MFE can be REBUILT by the trader's own MT5 terminal — propose "request_broker_fill" for those and explain that the terminal will re-send the levels at its next sync; nothing changes instantly, and the terminal fills only what is still empty. Everything else in "gaps" is ONLY the trader's to supply: the timeframe, the setup, and above all the notes and the mental state. You may PROPOSE tags and mental states as actions, but notes, setups and strategy are the trader's judgement — for those, say what to write and why, then stop.
- These flag names are CONTRACT, not vocabulary. Never write "excursionsFillable", "rFillable", "costsFillable", "isAutoAccount" or any other JSON field name in your reply, never put field names in backticks, and never claim a flag "is false" — the trader has no screen showing flags, so quoting them reads as a malfunction. When "excursionsFillable" is false for the trades in question, say instead that the terminal captured no stop/target levels to resend, and fall back to proposing "request_broker_fill" for the bridge-sourced trades anyway (the terminal rechecks at its next sync) or explaining the fields stay manual. When it is true, say the terminal CAN resend the missing levels and propose the action.
- "behaviour" reports RELATIONAL habits measured across the sequence of trades — quote the numbers, never generalise beyond them: "revenge" lists a losing trade (by number) followed within minutes by a same-pair re-entry of at least the same size, with each reaction's minutesAfter and their combined extraPnl; "overtrading" lists local days above the trader's OWN max_trades_per_day rule with that day's net P&L — if the list is empty, the rule is either not set or respected, say which only if you can tell; "news" lists entries within 30 minutes of a high-impact release in one of the pair's currencies. Every number here was measured on the device; your job is to connect them into one honest sentence per finding, name the trades by number, and stop at the evidence. Never moralise without a number.
- "postMortem" appears when the trader opened the chat FROM one losing trade (focusTradeN). It is the measured anatomy of that loss: "stoppedThroughNoise" (adverse excursion ≥ 1R — the stop sat inside the noise), "nearMiss", "giveBack" (a real gain handed back), "lowCapture" (banked under half the move), "costsAteIt" (fees ≥ 15% of the loss), "noStop", "revengeTagged" (the trader's own mental-state tag), "noExcursions" (the journal cannot see the path — say so). Quote the mae/mfe/capture values present; sequence the findings into a diagnosis and one corrective suggestion. A finding list is evidence, not verdict: the trader still decides what it means.
- "weekly" is the last-7-local-days review, precomputed: trades, netPnl, winRatePct, avgR with its honest rSample, costs, incomplete count, attribution by setup and by session (label, trades, totalR, netPnl), and up to three "actions" keyed fillGaps / sessionFocus / cutCosts / reduceTargets / noAction. When the trader asks for a weekly report or "where is my edge", structure the answer as: the four headline numbers, where R concentrated (setup and session, with their samples), the cost line, then the actions as numbered suggestions. If rSample is small, say the week is thin before claiming an edge anywhere.
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
  // v2 adds the derived account block (limits, lock, progress); v3 adds the
  // numeric `gaps` audit; v4 adds behaviour, postMortem and weekly. v1..v3
  // clients are gone with their releases, but all four are accepted so a
  // stale bundle cannot brick the chat.
  if (c.v !== 1 && c.v !== 2 && c.v !== 3 && c.v !== 4) return null;

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

  // Completeness: how much of the journal is actually journaled. Same
  // whitelist discipline -- counts clamped, field names fixed.
  let completenessBlock: Record<string, unknown> | null = null;
  if (c.completeness && typeof c.completeness === 'object') {
    const k = c.completeness as Record<string, unknown>;
    const count = (x: unknown): number => {
      const v = num(x);
      return v !== null && v >= 0 && v < 1000000 ? Math.round(v) : 0;
    };
    const rawByField = (k.byField ?? {}) as Record<string, unknown>;
    const byField: Record<string, number> = {};
    for (const field of ['mental_state', 'timeframe', 'setup', 'notes', 'tags']) {
      byField[field] = count(rawByField[field]);
    }
    completenessBlock = {
      total: count(k.total),
      incomplete: count(k.incomplete),
      assessed: count(k.assessed),
      byField,
      worstTradeNs: Array.isArray(k.worstTradeNs)
        ? k.worstTradeNs.map(count).filter(n => n > 0).slice(0, 10)
        : [],
    };
  }

  // Gaps, v3: what the NUMERIC record is missing, per sent trade. The
  // booleans are coerced to real booleans and the trade numbers are
  // intersected with the trades actually forwarded -- a number outside the
  // window would invite the model to describe a trade it does not have.
  let gapsBlock: Record<string, unknown> | null = null;
  if (c.gaps && typeof c.gaps === 'object') {
    const g = c.gaps as Record<string, unknown>;
    const sentNs = new Set(trades.map(t => t.n));
    const flag = (x: unknown): boolean => x === true;
    const rawGapTrades = Array.isArray(g.trades) ? g.trades : [];
    const gapTrades = rawGapTrades
      .slice(0, 40)
      .map((t): Record<string, unknown> | null => {
        if (typeof t !== 'object' || t === null) return null;
        const q = t as Record<string, unknown>;
        const n = num(q.n);
        if (n === null || !sentNs.has(n)) return null;
        return {
          n: Math.round(n),
          r: flag(q.r),
          rFillable: flag(q.rFillable),
          stop: flag(q.stop),
          target: flag(q.target),
          exit: flag(q.exit),
          costs: flag(q.costs),
          costsFillable: flag(q.costsFillable),
          excursions: flag(q.excursions),
          excursionsFillable: flag(q.excursionsFillable),
          notes: flag(q.notes),
        };
      })
      .filter((x): x is Record<string, unknown> => x !== null)
      .slice(0, 25);
    const rawCounts = (g.counts ?? {}) as Record<string, unknown>;
    const count = (x: unknown): number => {
      const v = num(x);
      return v !== null && v >= 0 && v < 1000000 ? Math.round(v) : 0;
    };
    gapsBlock = {
      withGaps: Array.isArray(g.withGaps)
        ? g.withGaps.map(count).filter(n => n > 0 && sentNs.has(n)).slice(0, 60)
        : [],
      counts: {
        r: count(rawCounts.r),
        rFillable: count(rawCounts.rFillable),
        stop: count(rawCounts.stop),
        target: count(rawCounts.target),
        exit: count(rawCounts.exit),
        costs: count(rawCounts.costs),
        costsFillable: count(rawCounts.costsFillable),
        excursions: count(rawCounts.excursions),
        excursionsFillable: count(rawCounts.excursionsFillable),
        notes: count(rawCounts.notes),
      },
      trades: gapTrades,
    };
  }

  // Behaviour, v4: relational findings with their trade numbers, minutes
  // and P&L. Counts are clamped, trade numbers intersected with the sent
  // window, and every nested object is whitelisted field by field -- same
  // discipline as the rest of the context.
  let behaviourBlock: Record<string, unknown> | null = null;
  if (c.behaviour && typeof c.behaviour === 'object') {
    const b = c.behaviour as Record<string, unknown>;
    const sentNs = new Set(trades.map(t => t.n));
    const cnt = (x: unknown): number => {
      const v = num(x);
      return v !== null && v >= -1000000000 && v < 1000000000 ? v : 0;
    };
    const revenge = Array.isArray(b.revenge) ? b.revenge : [];
    const overtrading = Array.isArray(b.overtrading) ? b.overtrading : [];
    const news = Array.isArray(b.news) ? b.news : [];
    behaviourBlock = {
      revenge: revenge.slice(0, 10).map((x): Record<string, unknown> | null => {
        if (typeof x !== 'object' || x === null) return null;
        const q = x as Record<string, unknown>;
        const triggerN = num(q.triggerN);
        if (triggerN === null || !sentNs.has(triggerN)) return null;
        return {
          kind: 'revenge',
          triggerN: Math.round(triggerN),
          reactions: (Array.isArray(q.reactions) ? q.reactions : [])
            .slice(0, 5)
            .map((y): Record<string, unknown> | null => {
              if (typeof y !== 'object' || y === null) return null;
              const w = y as Record<string, unknown>;
              const n = num(w.n);
              if (n === null || !sentNs.has(n)) return null;
              return {
                n: Math.round(n),
                minutesAfter: cnt(w.minutesAfter),
                samePair: w.samePair === true,
              };
            })
            .filter((y): y is Record<string, unknown> => y !== null),
          extraPnl: cnt(q.extraPnl),
        };
      }).filter((x): x is Record<string, unknown> => x !== null),
      overtrading: overtrading.slice(0, 7).map((x): Record<string, unknown> | null => {
        if (typeof x !== 'object' || x === null) return null;
        const q = x as Record<string, unknown>;
        return {
          kind: 'overtrading',
          date: str(q.date, 10) ?? '',
          trades: cnt(q.trades),
          limit: cnt(q.limit),
          dayPnl: cnt(q.dayPnl),
        };
      }).filter((x): x is Record<string, unknown> => x !== null),
      news: news.slice(0, 10).map((x): Record<string, unknown> | null => {
        if (typeof x !== 'object' || x === null) return null;
        const q = x as Record<string, unknown>;
        const n = num(q.n);
        if (n === null || !sentNs.has(n)) return null;
        return {
          kind: 'news',
          n: Math.round(n),
          eventTitle: str(q.eventTitle, 60) ?? '',
          eventCurrency: str(q.eventCurrency, 8) ?? '',
          minutesFromEvent: cnt(q.minutesFromEvent),
        };
      }).filter((x): x is Record<string, unknown> => x !== null),
      examined: cnt(b.examined),
    };
  }

  // Post-mortem, v4: the measured anatomy of the focused trade's loss.
  let postMortemBlock: Record<string, unknown> | null = null;
  if (c.postMortem && typeof c.postMortem === 'object') {
    const p = c.postMortem as Record<string, unknown>;
    const ALLOWED_KEYS = [
      'stoppedThroughNoise',
      'nearMiss',
      'giveBack',
      'lowCapture',
      'costsAteIt',
      'noStop',
      'revengeTagged',
      'noExcursions',
    ];
    const ratio = (x: unknown): number | null => {
      const v = num(x);
      return v !== null && v >= -50 && v <= 50 ? v : null;
    };
    postMortemBlock = {
      n: num(p.n),
      isLoss: p.isLoss === true,
      findings: (Array.isArray(p.findings) ? p.findings : [])
        .slice(0, 8)
        .map((x): Record<string, unknown> | null => {
          if (typeof x !== 'object' || x === null) return null;
          const q = x as Record<string, unknown>;
          if (typeof q.key !== 'string' || !ALLOWED_KEYS.includes(q.key)) return null;
          const out: Record<string, unknown> = { key: q.key };
          const v = ratio(q.value);
          if (v !== null) out.value = v;
          return out;
        })
        .filter((x): x is Record<string, unknown> => x !== null),
      session: str(p.session, 20),
      mental: str(p.mental, 20),
      mae: ratio(p.mae),
      mfe: ratio(p.mfe),
      capture: ratio(p.capture),
      costShareOfLoss: ratio(p.costShareOfLoss),
    };
  }

  // Weekly, v4: the last-7-days attribution and actions.
  let weeklyBlock: Record<string, unknown> | null = null;
  if (c.weekly && typeof c.weekly === 'object') {
    const w = c.weekly as Record<string, unknown>;
    const cnt = (x: unknown): number => {
      const v = num(x);
      return v !== null && v >= 0 && v < 1000000 ? Math.round(v) : 0;
    };
    const money = (x: unknown): number | null => {
      const v = num(x);
      return v !== null && v >= -1000000000 && v < 1000000000 ? v : null;
    };
    const bucket = (x: unknown): Record<string, unknown> | null => {
      if (typeof x !== 'object' || x === null) return null;
      const q = x as Record<string, unknown>;
      return {
        label: str(q.label, 24) ?? '',
        trades: cnt(q.trades),
        totalR: money(q.totalR),
        rSample: cnt(q.rSample),
        netPnl: money(q.netPnl),
      };
    };
    const ACTION_KEYS = ['fillGaps', 'tightenStop', 'sessionFocus', 'cutCosts', 'reduceTargets', 'noAction'];
    weeklyBlock = {
      days: cnt(w.days),
      trades: cnt(w.trades),
      netPnl: money(w.netPnl) ?? 0,
      winRatePct: money(w.winRatePct),
      avgR: money(w.avgR),
      rSample: cnt(w.rSample),
      costs: money(w.costs),
      incomplete: cnt(w.incomplete),
      bySetup: (Array.isArray(w.bySetup) ? w.bySetup : []).slice(0, 5)
        .map(bucket).filter((x): x is Record<string, unknown> => x !== null),
      bySession: (Array.isArray(w.bySession) ? w.bySession : []).slice(0, 4)
        .map(bucket).filter((x): x is Record<string, unknown> => x !== null),
      actions: (Array.isArray(w.actions) ? w.actions : []).slice(0, 3)
        .map((x): Record<string, unknown> | null => {
          if (typeof x !== 'object' || x === null) return null;
          const q = x as Record<string, unknown>;
          if (typeof q.key !== 'string' || !ACTION_KEYS.includes(q.key)) return null;
          const out: Record<string, unknown> = { key: q.key };
          const v = money(q.value);
          if (v !== null) out.value = v;
          if (typeof q.label === 'string') out.label = q.label.slice(0, 24);
          return out;
        })
        .filter((x): x is Record<string, unknown> => x !== null),
    };
  }

  const contextOut = {
    locale: str(c.locale, 8) ?? 'fr',
    accountType: str(c.accountType, 24),
    stats,
    trades,
    focusTradeN: num(c.focusTradeN),
    account: accountBlock,
    excursions: excursionsBlock,
    isAutoAccount: c.isAutoAccount === true,
    completeness: completenessBlock,
    gaps: gapsBlock,
    behaviour: behaviourBlock,
    postMortem: postMortemBlock,
    weekly: weeklyBlock,
  } as Record<string, unknown> & { v: number };
  contextOut.v = typeof c.v === 'number' ? c.v : 4;
  return contextOut;
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

    /**
     * An optional action the model may PROPOSE, never perform.
     *
     * Expressed as a trailing JSON block so the prose stays readable if the
     * client is older and ignores it. Whitelisted field by field here, then
     * resolved and confirmed on the device -- the server does not write
     * either, and the model never holds a write at any point.
     */
    let action: Record<string, unknown> | null = null;
    let prose = reply;
    const marker = reply.lastIndexOf('<<<ACTION');
    if (marker >= 0) {
      prose = reply.slice(0, marker).trim();
      const rawBlock = reply.slice(marker + '<<<ACTION'.length).replace(/>>>\s*$/, '');
      try {
        const parsed = JSON.parse(rawBlock.trim());
        const kind = parsed?.kind;
        if (kind === 'add_tag' || kind === 'set_mental_state' || kind === 'filter_trades' || kind === 'set_r_multiple' || kind === 'set_costs' || kind === 'request_broker_fill') {
          action = {
            kind,
            tradeNs: Array.isArray(parsed.tradeNs)
              ? parsed.tradeNs
                  .filter((n: unknown) => typeof n === 'number' && Number.isFinite(n))
                  .slice(0, 50)
              : [],
          };
          if (typeof parsed.tag === 'string') action.tag = parsed.tag.slice(0, 24);
          if (typeof parsed.mentalState === 'string') {
            action.mentalState = parsed.mentalState.slice(0, 16);
          }
        }
      } catch {
        // A malformed block is dropped; the prose still stands on its own.
      }
    }

    return json({ reply: prose.slice(0, 4000), action, model: modelUsed });
  } catch (e) {
    console.error('chat: unexpected', e);
    return json({ error: 'upstream_error' }, 502);
  }
});
