# AI coach — Edge Function

Turns the findings computed on-device by `computeInsights` into a short written
briefing. It is the **only** part of the app that talks to a model.

## Why this is server-side

An Expo app ships its JS bundle to the device. Anything in `EXPO_PUBLIC_*` is
readable by anyone who installs the app, so a model API key placed in the
client is a published key — billed to you until it is revoked. The key lives
only in this function's environment.

## Deploy

```bash
supabase functions deploy coach
supabase secrets set OPENAI_API_KEY=sk-...
```

No client change is needed. Until the secret is set the function returns
`503 not_configured`, and the app shows "AI summary is not configured" rather
than a generic error.

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
