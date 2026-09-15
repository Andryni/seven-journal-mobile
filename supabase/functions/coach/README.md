# AI coach — Edge Function

Turns the findings computed on-device by `computeInsights` into a short written
briefing. It is the **only** part of the app that talks to a model.

## Why this is server-side

An Expo app ships its JS bundle to the device. Anything in `EXPO_PUBLIC_*` is
readable by anyone who installs the app, so a model API key placed in the
client is a published key — billed to you until it is revoked. The key lives
only in this function's environment.

## Deploy

Pick one provider. Gemini is preferred when both keys are present.

### Gemini (free tier, no credit card)

```bash
supabase functions deploy coach
supabase secrets set GEMINI_API_KEY=AIza...
```

Get the key at <https://aistudio.google.com/apikey> — sign in with a Google
account, "Create API key", done.

**The key must start with `AIza`.** A Google AI Studio API key is a ~39
character string beginning with those four letters. Anything shaped like
`AQ.Ab8...` is a different Google credential — an OAuth / short-lived access
token — and the Gemini REST endpoint will reject it with `401`. Those also
expire within the hour, so they cannot be used as a stored secret.

### Choosing the model

```bash
# Optional. Defaults to gemini-2.5-flash.
supabase secrets set GEMINI_MODEL=gemini-3.8-flash
```

Flash rather than Pro: this task is short-form rewriting of findings that are
already computed, and Google removed Pro models from the free tier in April
2026 while Flash kept its allowance.

The model id is read from a secret because **Google retires them on a
schedule**. `gemini-2.0-flash`, which this function hardcoded until now, is
already discontinued, and the 2.5 family has a published shutdown date. When
that lands, set the secret — no code change, no redeploy of the app.

Current ids and free limits are at
<https://ai.google.dev/gemini-api/docs/models> and
<https://ai.google.dev/gemini-api/docs/rate-limits>. Check there rather than
trusting a number written here; this file will go stale. It matters little
either way: the endpoint fires only when the user presses the button.

Two things worth knowing before choosing the free tier: Google may use free
tier traffic to train its models, and the free tier is not offered in the
EU/EEA/UK/Switzerland. The payload contains no trades, prices, notes or
balances — only anonymous finding ids and ratios — but if that is still not
acceptable, use the paid option below.

### OpenAI (paid)

```bash
supabase functions deploy coach
supabase secrets set OPENAI_API_KEY=sk-...
```

No client change is needed for either. Until a secret is set the function
returns `503 not_configured`, and the app shows "AI summary is not configured"
rather than a generic error. A daily-cap refusal returns `429 rate_limited`,
which the app shows as "try again tomorrow" — actionable, unlike a generic
failure.

## What is sent

Built by `src/features/insights/buildCoachPayload.ts`, which is unit-tested
specifically for what it *omits*:

```jsonc
{
  "v": 1,
  "locale": "fr",
  "tradesAnalysed": 142,
  "winRate": 54.2,
  "avgR": 0.31,
  "planAdherence": 78.5,
  "profitFactor": 1.4,
  "findings": [
    { "id": "revenge-trading", "severity": "critical", "impactPct": -18.4, "sampleSize": 12 }
  ]
}
```

Never sent: individual trades, prices, timestamps, instruments, account names
or ids, balances, and notes. Notes matter most — they are free text and
regularly contain personal information.

Impacts are percentages of the book's P&L volume, never currency amounts, so
the payload is identical whether the account holds 500 or 500,000. A test
asserts this by scaling a book 1000x and diffing the payload.

## Why the model may not produce numbers

The system prompt forbids digits, and the response is additionally stripped of
them server-side. A model asked to compute a win rate will produce a confident,
slightly wrong one, and a journal that contradicts its own statistics is worse
than one with no summary. Every figure the user sees comes from
`computeInsights`, on the device. The model only supplies prose and ordering.

## Hardening

- Requires a Supabase JWT (`Authorization: Bearer`); otherwise this is an open
  proxy to a paid API.
- Re-validates the payload server-side and rebuilds it field by field, so extra
  keys from a future client bug are dropped rather than forwarded.
- Caps findings at 12 and rejects payloads under 20 trades.
- Upstream error bodies are logged, never returned — they can carry key or org
  details.
