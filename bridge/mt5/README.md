# Pont MT5 → Seven Journal (EA MQL5)

`SevenJournalSync.mq5` surveille l'historique du terminal MetaTrader 5 et
pousse chaque position vers votre journal Seven Journal : **une ligne par
position**, ouvertes incluses (elles se complètent à la clôture), P&L net de
commissions et swaps, sorties partielles détaillées.

**Écriture seule.** Le secret du connecteur ne permet jamais de lire quoi que
ce soit — il ne peut qu'alimenter votre file de validation. Rien n'entre dans
le journal sans votre validation dans l'app.

---

## Installation (10 minutes)

### 1. Créer le connecteur dans l'app

Seven Journal → **Plus → Journal auto → Ajouter un connecteur** →
plateforme **MT5 (MetaTrader 5)** → choisissez le **compte du journal à
automatiser** (les trades de ce compte broker iront dedans). Copiez les deux
valeurs affichées :

- **URL du webhook** : `https://aeqyqwchxvcfvbbapqch.supabase.co/functions/v1/sync-ingest`
- **Secret du connecteur** (une longue chaîne — elle ne se réaffiche pas)

### 2. Autoriser l'URL dans MetaTrader 5

**Outils → Options → Expert Advisors** :

1. Cocher **« Autoriser le trading algorithmique »** (déjà fait si vous
   utilisez des EA)
2. Cocher **« Autoriser WebRequest pour les URL listées »**
3. Ajouter l'URL du webhook dans la liste (uniquement la partie
   `https://VOTRE-PROJET.supabase.co`)

Sans cette étape, l'EA affiche *« URL non autorisée »* dans l'onglet Experts
(et 4014 dans le journal).

> **Paramètres vides au moment de l'attachement ?** Depuis la v1.11 l'EA ne
> disparaît plus avec un cryptique « failed with code 32767 » : il reste sur
> le graphique, affiche **« PARAMÈTRES MANQUANTS »** en orange dans son
> panneau et lève une **Alerte** popup. Re-attachez-le en remplissant l'onglet
> **Paramètres** (URL + secret) et il passe en **« ACTIF »** (vert).

### 3. Installer l'EA

1. MetaTrader 5 → **Fichier → Ouvrir le dossier de données** →
   `MQL5/Experts/` → copier `SevenJournalSync.mq5` dedans
2. Dans MetaEditor (F4), ouvrir le fichier et cliquer **Compiler** (F7) —
   « 0 errors » attendu
3. Retour dans MT5 : glisser **SevenJournalSync** sur **n'importe quel
   graphique** (M15 conseillé), cocher **« Autoriser le trading
   algorithmique »** dans la fenêtre, coller **URL** et **Secret**

Le smiley 😀 en haut à droite du graphique = EA actif. Vérifiez dans
l'onglet **Experts** : `SevenJournalSync: actif. Premier scan : historique
complet du compte.` — et le **panneau de statut** en haut à gauche du
graphique indique en direct : état (ACTIF vert / PARAMÈTRES MANQUANTS
orange), dernier envoi (heure + code HTTP), nombre de positions.

### 4. Le premier envoi

Au premier attachement, l'EA envoie **tout l'historique du compte** (positions
fermées depuis l'ouverture, par lots de 400) + les positions actuellement
ouvertes. Ils apparaissent dans **Journal auto → File de validation** :
chiffres pré-remplis, à vous de promouvoir / lier / ignorer. Après un envoi
complet, seules les nouvelles positions partent à chaque scan.

---

## Paramètres

| Input | Défaut | Rôle |
|---|---|---|
| `InpWebhookUrl` | — | URL du webhook (étape 1) |
| `InpSecret` | — | Secret du connecteur (étape 1) |
| `InpScanSeconds` | 15 | Fréquence du scan de l'historique |
| `InpBeatSeconds` | 60 | Fréquence du heartbeat (positions ouvertes) |
| `InpTimeoutMs` | 10000 | Timeout réseau par requête |
| `InpOverlapMinutes` | 120 | Recouvrement anti-trou à chaque scan |

> **Déjà branché avec la v1.00 ?** La v1.10 importe tout l'historique au
> premier attachement via une nouvelle variable watermark. Pour déclencher
> l'import complet : **F3** (Terminal → Variables globales) → supprimer
> `SevenJournalSync_watermark` → re-attacher l'EA v1.10.
>
> **v1.13 — re-import automatique :** le watermark a été renommé
> (`SevenJournalSync_watermark_v3`), donc la première exécution de cette
> version **ré-importe tout l'historique avec les niveaux SL/TP** lus dans
> les deals — sans manipulation. Le serveur dédoublonnant par position, les
> trades déjà promus ne reviennent pas dans la file : seuls leurs payloads
> sont rafraîchis, et le R peut enfin être recalculé côté base.
>
> **v1.16 — demande de complétion sur une position ouverte :** quand l'app
> demande au terminal de renvoyer les niveaux manquants (`request_broker_fill`),
> la demande peut viser une position **encore ouverte**. Jusqu'ici l'EA la
> reconstruisait comme fermée (aucun deal de sortie à lire) : le serveur y
> voyait une clôture, datait le trade 1970 et la vraie clôture ne pouvait plus
> le compléter. La v1.16 détecte la position vivante et renvoie son état
> courant, SL/TP inclus. **Recompilez le `.mq5` (F7) puis re-attachez l'EA**
> pour en bénéficier — le `.ex5` fourni ici est compilé depuis la v1.15.

## Comment ça marche

- **Watermark persisté** (`Variables globales` du terminal) : après un
  redémarrage du terminal ou du VPS, rien n'est perdu ni renvoyé en double
  (l'overlap de sécurité + le dédoublonnage serveur absorbent les cas limites)
- **Agrégation par position** : deals d'entrée sommés (taille, prix moyen
  pondéré, heure la plus ancienne), sorties listées une à une,
  `pnl = Σprofit − Σcommission − Σswap`
- **Raison de clôture** : TP/SL détectés via la raison du dernier deal de
  sortie ; clôture manuelle, expert ou stop-out marge → `CLOSED` ; P&L ≈ 0 →
  `BE`
- **Heartbeat** : la liste des positions ouvertes, 60 s — met à jour le statut
  « connecteur » dans l'app ; une position en file qui disparaît des
  heartbeats passe en `stale` (récupérable si elle réapparaît)
- **Retry** : 3 essais avec backoff sur erreur réseau ; les erreurs 4xx
  (mauvais secret, payload refusé) ne sont pas retentées

## Conseils

- **Terminal ouvert = synchro active.** Sur un PC qui s'éteint, utilisez un
  VPS (beaucoup de brokers en offrent un gratuit à partir d'un certain
  volume) ou laissez le terminal tourner sur une machine toujours allumée
- **Un connecteur par compte broker** : créez un connecteur distinct dans
  l'app pour chaque terminal MT5 (le secret lie les events à un compte)
- Le secret a tourné de travers / fuité ? **Appui long sur le connecteur dans
  Journal auto → Régénérer le secret** : l'ancien devient inutilisable
  immédiatement, mais le connecteur, son compte lié et sa file sont conservés.
  Collez le nouveau secret dans l'onglet Paramètres de l'EA. Le même appui long
  permet de renommer le connecteur ou de mettre son alimentation en pause sans
  rien perdre

## Limites connues (v1)

- MAE/MFE (excursions) ne sont calculés qu'**à la demande** (demande de
  complétion depuis le coach ou le bouton « compléter avec le broker ») : les
  scanner à chaque passage sur toutes les positions coûterait trop cher. Sans
  demande, les colonnes restent vides et les stats qui en dépendent s'adaptent
- MT4 n'a pas d'identifiant de position : un pont MT4 dédié utilisera le
  ticket d'ordre (à venir)
- Les dépôts/retraits ne sont pas des trades : ils ne passent pas par le pont
