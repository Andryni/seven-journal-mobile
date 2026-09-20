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
- **Réparer un connecteur ne veut plus dire le supprimer** :
  `rename_sync_ingest_account` (nom, unicité revalidée),
  `rotate_sync_ingest_secret` (même ligne, même id, même routage, même file,
  nouveau secret renvoyé une fois et bookkeeping de sync remis à zéro) et
  `set_sync_ingest_active` (pause/reprise ; l'Edge Function refuse déjà un
  connecteur inactif avec 403).

## 6. Contrat payload (EA MT5)

Une ligne **par position** : deals d'entrée agrégés (taille, prix moyen
pondéré, heure la plus ancienne), sorties listées, `pnl` NET
(Σprofit − Σcommission − Σswap). Voir le README de `sync-ingest` pour
l'exemple JSON complet, et `bridge/mt5/` pour le producteur.

## 6bis. Aller-retour de complétion (chat → terminal → journal)

Quand le journal ne peut pas dériver un R (SL ou sortie manquants) mais que la
position vient du pont, le coach propose `request_broker_fill` :

1. `sync_requests` reçoit une ligne par `external_id` (dédupliquée tant qu'une
   demande est `pending`).
2. La demande part dans la **réponse du heartbeat** suivant ; l'EA reconstruit
   la position et la renvoie sur le canal `trades`, enrichie de
   `stop_loss`/`take_profit`/`mae_price`/`mfe_price`.
3. `apply_broker_refresh` ne remplit que les champs **vides** du trade déjà
   journalisé (jamais d'écrasement, jamais de création).
4. Côté app, `useAutoFillBroker` détecte que le R d'un trade existant est
   devenu dérivable et l'écrit automatiquement (`brokerArrivals.ts`) : le
   trader n'a plus à redemander.

Invariants qui rendent la boucle sûre :

- **Une reconstruction de position vivante n'est pas une clôture.** C'est un
  événement `is_open:false` sans deal de sortie, donc sans `exit_price`. Il met
  à jour le payload, jamais `is_open` ni `close_time` du staging : sinon le
trade était daté 1970 et la vraie clôture ne pouvait plus le compléter.
- **`resolution`, pas `status`, dit qu'un trade existe déjà** : une position
  promue ouverte garde sa ligne `pending` (la clôture doit encore la
  compléter). Toute garde basée sur `status='promoted'` loupe exactement ces
  lignes-là.
- `apply_broker_close` remplit aussi les SL/TP vides et n'écrase plus les
  MAE/MFE déjà récupérés par un back-fill.
- L'app affiche les demandes encore `pending` sur le connecteur : la promesse
  "envoyé au terminal" devient vérifiable.
- Le heartbeat annonce la **version de l'EA** (`ea_version`, v1.16+), donc
  l'app sait si ce terminal SAIT répondre : version < 1.15 → la ligne du
  connecteur le dit, absence de version → build antérieur à la v1.16 et un
  avertissement (la complétion n'est pas garantie). Politique et seuils :
  `src/features/sync/eaVersion.ts` ; payload : README de `sync-ingest`.

## 6ter. Replay de bougies (v1.17+)

Le même canal requête/réponse porte un second type de demande : l'app demande
une **fenêtre de bougies M1** (`kind: 'candles'`, symbole + deux bornes), le
terminal répond **une fois** sur le canal `trades` avec des barres OHLC.

Règles qui gardent la fonctionnalité honnête :

- La fenêtre demandée est calculée à partir du trade (entrée − marge, sortie +
  marge) et **bornée** : un historique de courtier ne remonte pas indéfiniment,
  et une demande hors de ce que le terminal a en mémoire est une demande
  refusée, pas une demande qui bloque la file.
- Le client **cache par trade** : une demande satisfaite n'est jamais renvoyée,
  sinon chaque ouverture du détail relancerait le terminal.
- Sans réponse, l'écran le dit et propose de (re)demander — il n'invente aucune
  bougie de remplacement. C'est la même règle que pour les niveaux : la donnée
  vient du broker ou elle n'est pas affichée.
- Une version d'EA < 1.17 ne sait pas répondre aux bougies : le seuil est dans
  `src/features/sync/eaVersion.ts`, comme celui de la complétion.

## 7. Tests d'acceptation

1. Re-delivery webhook ×2 → 1 ligne staging, 2 raw events
2. OPEN puis CLOSED → même ligne ; si promu entre-temps, le trade journal est complété
3. Promotion avec sorties partielles → 1 trade + N `trade_exits`, pnl net
4. Link : champs humains gagnent, broker remplit les NULL, `pnl_gap` flaggé
5. stale → recovery quand le payload revient
6. Promotion de pertes du jour → Lock Guard se déclenche
7. Deux imports identiques → 1 ligne
8. Payload falsifié (user_id d'autrui) → ignoré (user_id vient du secret)
9. Back-fill d'une position encore ouverte → payload rafraîchi, **aucune**
   clôture écrite (pas d'exit_price, pas de date 1970)
10. Clôture d'une position promue ouverte → exit_price, pnl, result, SL/TP
    (gap-only) et R calculés
11. Rotation de secret → même connecteur, même file, ancien secret rejeté
    (401) au heartbeat suivant
12. Demande de bougies sur un trade → réponse mise en cache, **aucune**
    seconde demande à la réouverture ; trade hors historique → refus explicite
13. Renommage / mise en pause d'un connecteur → la réponse ne renvoie
    **jamais** le secret stocké (void, pas de SELECT de la ligne)

## 8. Hors scope v1

Dépôts/retraits (balance events) ; Rithmic/Tradovate (pas de voie gratuite
vérifiée → CSV) ; table d'alias de symboles persistée (constante dans
l'Edge Function pour l'instant) ; pont MT4 (ticket d'ordre comme
external_id).
