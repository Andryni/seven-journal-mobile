# sync-ingest — webhook d'ingestion du journal automatique

Point d'entrée **write-only** unique pour tous les ponts (EA MT5, import CSV,
cTrader plus tard). Le secret porté par l'appelant identifie le connecteur et
son propriétaire : le `user_id` est **toujours dérivé du secret**, jamais du
payload. Aucune lecture n'est exposée — les trades n'atteignent le journal
qu'via les RPCs humaines (promouvoir / lier / ignorer).

Schéma : `supabase/schema.sql` (SECTION 4). Design : `docs/auto-journal-sync.md`.

## Déploiement

```bash
npx supabase functions deploy sync-ingest
```

Aucune variable personnalisée : la fonction utilise `SUPABASE_URL` et
`SUPABASE_SERVICE_ROLE_KEY`, fournies par Supabase à l'exécution.

## Endpoints & codes de retour

`POST /functions/v1/sync-ingest` — `Authorization: Bearer <secret du connecteur>`

| Code | Signification |
|---|---|
| 200 | Traitement OK — `{ inserted, updated, rejected, closedCompleted }` |
| 401 | Secret inconnu ou absent |
| 403 | Connecteur désactivé (`is_active = false`) |
| 405 | Méthode non POST |
| 422 | JSON invalide, `type` inconnu, ou 0/500+ events — **le payload reste archivé** dans `sync_raw_events` (replay possible) |

## Contrats de payload

### `type: "trades"` (EA MT5, import CSV)

Une ligne **par position broker** : deals d'entrée agrégés (taille, prix moyen
pondéré, heure la plus ancienne), sorties listées, `pnl` **NET**
(profit − commission − swap). Voir `docs/auto-journal-sync.md` pour le contrat
complet et un exemple JSON.

### `type: "heartbeat"` (toutes les 60 s par l'EA)

```json
{ "type": "heartbeat", "open_ids": ["123456", "123457"] }
```

Met à jour le statut du connecteur, ne crée aucune ligne. Les positions
ouvertes en file qui n'apparaissent plus → `stale` (récupérable : le payload
du trade qui réapparaît repasse la ligne en `pending`).

## Test rapide (curl)

```bash
# 1. Créer un connecteur dans l'app (Journal auto → Ajouter un connecteur),
#    copier l'URL du webhook et le secret, puis :

curl -X POST "https://VOTRE-PROJET.supabase.co/functions/v1/sync-ingest" \
  -H "Authorization: Bearer VOTRE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "trades",
    "events": [{
      "external_id": "123456",
      "symbol": "XAUUSD",
      "direction": "BUY",
      "size": 0.5,
      "entry_price": 2330.55,
      "entry_time": "2026-09-18T09:31:22Z",
      "is_open": false,
      "close_time": "2026-09-18T10:12:40Z",
      "pnl": 145.30,
      "commission": 3.50,
      "swap": 0.00,
      "close_reason": "TP",
      "exits": [{ "size": 0.2, "price": 2338.00, "exit_time": "2026-09-18T09:55:10Z", "pnl": 60.10 }]
    }]
  }'

# 2. Le trade apparaît dans la file (Journal auto) — il n'est PAS encore
#    dans `trades`. Promouvez-le depuis l'app, puis vérifiez :

curl -X POST ".../functions/v1/sync-ingest" -H "Authorization: Bearer ..." \
  -d '{"type": "heartbeat", "open_ids": []}'

# 3. Re-postez le même payload : `{ inserted: 0, updated: 1 }` — le dédoupe
#    est structurel.
```

## Dépannage

| Symptôme | Cause probable |
|---|---|
| 401 | Secret copié avec espaces, ou mauvais projet |
| 422 `bad_events_count` | `events` manquant ou > 500 |
| 422 `invalid_json` | Corps non-JSON (l'archive brut est créée) |
| Connecteur « erreur » dans l'app | `last_error` sur la ligne `sync_ingest_accounts` |
| File vide malgré 200 | Events rejetés au parse — `{ rejected }` le compte ; le payload brut est dans `sync_raw_events` pour rejouer |

**Rétention** : `sync_raw_events` est purgé à 30 jours par **pg_cron nocturne**
(job `purge-sync-raw`, planifié par `supabase/schema.sql` — tous les jours à
03:30 UTC). La fonction d'ingest ne balaye plus rien sur le chemin chaud.
Prérequis : extension `pg_cron` activée une fois dans Dashboard → Extensions.
