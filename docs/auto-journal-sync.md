# Auto-journal — modèle de données de synchronisation

> Document de conception. Implémentation : `supabase/schema.sql` (SECTION 4 —
> AUTO-JOURNAL SYNC), Edge Function `supabase/functions/sync-ingest/`, pont
> MT5 `bridge/mt5/`, écran `src/screens/AutoJournalScreen.tsx`.

## 0. Décisions produit arrêtées

| Décision | Choix |
|---|---|
| Entrée des trades du broker | **File de validation** : rien n'atteint `trades` sans un tap humain |
| Positions ouvertes | **Incluses dès la v1** : le flux porte les états `OPEN → CLOSED` |
| Raison de clôture inconnue | **`CLOSED` ajouté** au check `trades.result` |
| Sources v1 | EA MQL5 (MT5) → webhook, import CSV (plus tard), cTrader Open API (plus tard) |
| Infra | Edge Function unique `/sync-ingest` + tables de staging, tier gratuit Supabase |

## 1. Principes

1. **`trades` reste la source de vérité du journal.** La sync n'y écrit jamais
   en direct : elle remplit `sync_trades` (staging) et *propose*.
2. **Le dédoublonnage est structurel** : `UNIQUE (ingest_account_id,
   external_id)` sur la staging. Un webhook reçu deux fois est un no-op.
3. **Jamais d'auto-merge** avec les trades manuels : `match_candidates`
   *propose*, l'humain tranche via `link_sync_trade`.
4. **Idempotent partout** : upserts sur clés naturelles, replay sûr.
5. **Le Lock Guard n'est pas contourné** : il protège le risque à prendre, pas
   l'historique. Promouvoir des pertes du jour peut verrouiller la journée —
   cohérent avec l'import de trades passé.
6. **Chaîne de custody auditable** : le payload brut est stocké dans
   `sync_raw_events` AVANT tout parsing ; promotion = 1 RPC transactionnel
   revalidé côté serveur.

## 2. Flux

```
[EA MT5]──POST──┐
[CSV (à venir)]─┤→ Edge Function /sync-ingest (secret → user_id)
[cTrader (plus  │        │
 tard)]─────────┘        ▼
                sync_raw_events (audit brut, 30 j)
                         ▼
                sync_trades (file, unique(ingest_account_id, external_id))
                         │  promote / link / dismiss (RPC humain, 1 TX)
                         ▼
                    trades (+ trade_exits)
```

## 3. Machine à états de `sync_trades.status`

```
pending ──promote──▶ promoted (→ trades créé, trades.sync_source_id rempli)
pending ──link─────▶ linked   (→ trade manuel existant enrichi)
pending ──dismiss──▶ dismissed (raisons : not_mine | test | duplicate)
pending ──(absent des heartbeats)──▶ stale ──(payload revient)──▶ pending
```

- Position **ouverte** : ligne en file (`is_open=true`). À la clôture, l'EA
  renvoie le même `external_id` : la **même ligne** est mise à jour. Si le
  trade a déjà été promu, `apply_broker_close` complète le trade journal.
- `dismissed` est un état humain définitif : un renvoi du payload ne le
  réactive pas. `stale` est récupérable.

## 4. Matching avec les trades manuels (proposé, jamais automatique)

Candidats = même compte routé, même pair **normalisée**
(`normalize_pair()` : EURUSD.m → EURUSD), même direction, |Δ entry_time| ≤
`match_window_s` (90 s par défaut), |Δ size| ≤ 2 %.

**Politique de fusion à la liaison** : les champs saisis par l'humain
gagnent ; le broker ne remplit que les NULL (exit_price, pnl, result,
commission, swap, mae/mfe, exits). Un écart de P&L est flaggé (`pnl_gap`)
et affiché sur la carte de la file.

## 5. Sécurité

- Le `user_id` vient **toujours** du secret → `sync_ingest_accounts`, jamais
  du payload : un payload falsifié ne peut atterrir que dans la file du
  propriétaire du secret.
- Le webhook est **write-only** : aucune lecture exposée. L'app lit la file
  via PostgREST (RLS owner) et agit via RPCs authentifiés qui revalident
  tout.
- La création de connecteur passe par `create_sync_ingest_account`
  (secret généré côté serveur, `gen_random_bytes(32)`, affiché une fois).

## 6. Contrat payload (EA MT5)

Une ligne **par position** : deals d'entrée agrégés (taille, prix moyen
pondéré, heure la plus ancienne), sorties listées, `pnl` NET
(Σprofit − Σcommission − Σswap). Voir le README de `sync-ingest` pour
l'exemple JSON complet, et `bridge/mt5/` pour le producteur.

## 7. Tests d'acceptation

1. Re-delivery webhook ×2 → 1 ligne staging, 2 raw events
2. OPEN puis CLOSED → même ligne ; si promu entre-temps, le trade journal est complété
3. Promotion avec sorties partielles → 1 trade + N `trade_exits`, pnl net
4. Link : champs humains gagnent, broker remplit les NULL, `pnl_gap` flaggé
5. stale → recovery quand le payload revient
6. Promotion de pertes du jour → Lock Guard se déclenche
7. Deux imports identiques → 1 ligne
8. Payload falsifié (user_id d'autrui) → ignoré (user_id vient du secret)

## 8. Hors scope v1

Dépôts/retraits (balance events) ; Rithmic/Tradovate (pas de voie gratuite
vérifiée → CSV) ; table d'alias de symboles persistée (constante dans
l'Edge Function pour l'instant) ; pont MT4 (ticket d'ordre comme
external_id).
