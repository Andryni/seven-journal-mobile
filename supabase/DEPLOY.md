# Déployer la fonction `coach` — pas à pas

Tout se passe **dans le terminal Windows**, dans le dossier du projet
(`C:\Users\ANDRY\Documents\seven-journal-mobile`).

Rien à cliquer sur le site Supabase, sauf pour lire une valeur à l'étape 1.

---

## Pourquoi c'est nécessaire

Le bouton « Demander une synthèse » appelle une fonction qui tourne **sur les
serveurs Supabase**, pas dans l'application. Son code est dans le dépôt
(`supabase/functions/coach/`), mais il n'a jamais été **publié** — c'est ce
que dit le message « Service non déployé ».

La fonction tourne côté serveur pour une seule raison : la clé Gemini. Une app
Expo envoie son code JavaScript sur le téléphone, donc toute clé placée dans
l'app est lisible par n'importe qui l'installe. La clé reste sur le serveur.

---

## Étape 1 — Récupérer votre « project ref »

C'est l'identifiant de votre projet Supabase. Il est **déjà dans votre fichier
`.env`**, inutile d'aller le chercher ailleurs.

Ouvrez `.env` à la racine du projet. Vous y verrez une ligne comme :

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
```

Le **project ref**, c'est la partie entre `https://` et `.supabase.co` —
ici `abcdefghijklm`. Notez-la.

---

## Étape 2 — Se connecter au CLI Supabase

Dans le terminal, à la racine du projet :

```
npx supabase login
```

Une page s'ouvre dans le navigateur, vous vous connectez à votre compte
Supabase, et vous revenez au terminal. À faire une seule fois par machine.

---

## Étape 3 — Lier le dossier à votre projet

Remplacez `VOTRE_REF` par la valeur de l'étape 1 :

```
npx supabase link --project-ref VOTRE_REF
```

Le mot de passe de la base peut être demandé : c'est celui choisi à la
création du projet Supabase. Si vous ne l'avez plus, il se réinitialise sur
le site dans **Settings → Database → Reset database password**.

C'est cette étape qui manquait. Sans elle, le CLI ne sait pas à quel projet
s'adresser.

---

## Étape 3 bis — Appliquer le schéma (À NE PAS SAUTER)

Les fonctions ne suffisent pas : plusieurs features ont besoin de tables et
de colonnes qui n'existent pas encore dans votre base.

Ouvrez **SQL Editor** sur le site Supabase, collez **tout** le contenu de
`supabase/schema.sql`, exécutez.

Le script est idempotent (`create table if not exists`, `add column if not
exists`) : le relancer après chaque mise à jour du dépôt est sans danger, et
c'est la façon prévue de migrer.

Ce qui échoue silencieusement sans lui :

| Manque | Symptôme dans l'app |
|---|---|
| Tables `sync_*` | Le pont MT5 n'importe rien |
| `trades.seeded_fields` | Le coach ne peut pas dire ce qui manque |
| `trades.commission`, `swap`, `tags`, `mae_price`… | Les colonnes sont ignorées à l'enregistrement |

L'app est écrite pour survivre à une base non migrée — elle réessaie sans
les colonnes inconnues plutôt que de refuser d'enregistrer un trade — donc
rien ne plante. C'est précisément pour cela que l'oubli passe inaperçu.

---

## Étape 4 — Publier les fonctions

Il y en a quatre. Déployez-les toutes : une fonction absente se manifeste
dans l'app par « Service non déployé », et pour `sync-ingest` par un pont
qui n'importe rien du tout, sans message.

```
npx supabase functions deploy coach
npx supabase functions deploy chat
npx supabase functions deploy calendar
npx supabase functions deploy sync-ingest
```

| Fonction | Rôle | Secret requis |
|---|---|---|
| `coach` | Synthèse IA dans Analytics | `GEMINI_API_KEY` |
| `chat` | Onglet Coach (conversation) | le même |
| `calendar` | Bandeau économique du tableau de bord | aucun |
| `sync-ingest` | Webhook du pont MT5 / cTrader | aucun |

`calendar` lit le flux public de ForexFactory, garde les événements à
**impact élevé** sur les huit devises majeures, et met en cache 30 minutes
côté serveur.

`sync-ingest` est la seule fonction avec `verify_jwt = false` : l'EA tourne
dans MetaTrader, n'a pas de session Supabase, et s'authentifie avec le
secret de son connecteur — que la fonction vérifie elle-même. Voir
`supabase/functions/sync-ingest/README.md`.

Vérifiez que les quatre sont publiées :

```
npx supabase functions list
```

`chat` alimente l'onglet COACH (conversation). Il partage la clé et le modèle
de `coach` : aucun secret supplémentaire.

---

## Étape 5 — VÉRIFIER que c'est bien publié

**Ne sautez pas cette étape.** L'étape 4 peut se terminer sans erreur tout en
n'ayant rien publié — c'est précisément ce qui s'est produit jusqu'ici.

```
npx supabase functions list
```

`coach` doit apparaître avec le statut **ACTIVE**.

- Si la liste est vide → l'étape 3 n'a pas fonctionné, recommencez-la.
- Si `coach` est listé ACTIVE → c'est bon, passez à la suite.

---

## Étape 6 — Vérifier la clé Gemini

Les secrets sont stockés sur le serveur, séparément du code :

```
npx supabase secrets list
```

`GEMINI_API_KEY` doit apparaître. Sinon :

```
npx supabase secrets set GEMINI_API_KEY=AIza...
```

La clé **doit commencer par `AIza`**. Elle se crée sur
<https://aistudio.google.com/apikey> avec le bouton « Create API key ».

> Important : après avoir posé ou changé un secret, **redéployez**
> (`npx supabase functions deploy coach`). Les secrets sont lus au démarrage
> de la fonction.

---

## Étape 7 — Tester dans l'application

Rechargez l'app, puis : **Analytics → Comportement → « Demander une
synthèse »**.

Il faut être connecté : la fonction refuse un appel sans session valide.

---

## Si ça échoue encore

Chaque message de l'app désigne une cause précise :

| Message affiché | Ce qui ne va pas |
|---|---|
| Service non déployé | Étapes 3-5 : la fonction n'est pas publiée |
| Analyse IA non configurée | Pas de secret, ou clé refusée par Google (mauvais format, ou révoquée) |
| Quota d'analyses atteint | Limite journalière du palier gratuit — revenez demain |
| Session expirée | Déconnectez-vous et reconnectez-vous dans l'app |
| La synthèse a échoué | Google a refusé l'appel — la raison exacte s'affiche juste en dessous |
| Modèle IA introuvable | L'identifiant du modèle a été retiré — voir plus bas |

**La cause exacte est affichée dans l'application**, en petit sous le message
d'erreur : c'est la réponse de Google elle-même. (La commande
`supabase functions logs` n'existe pas dans le CLI ; les logs se consultent
sur le site, dans **Edge Functions → coach → Logs**.)

### « Modèle IA introuvable »

Google a retiré l'identifiant configuré. Le détail affiché sous le message
propose maintenant un remplaçant valide pour **votre** clé, sous la forme
`ancien → nouveau`. Appliquez-le :

```
npx supabase secrets set GEMINI_MODEL=le-modele-propose
npx supabase functions deploy coach
```

Le défaut actuel est `gemini-3.8-flash`, avec repli automatique sur
`gemini-3.1-flash-lite` si Google répond « modèle occupé » (503). Le modèle
qui a réellement répondu est visible dans le champ `model` de la réponse.

> Piège connu (septembre 2026) : un identifiant **listé** par le catalogue
> peut être **mort** pour la génération — `gemini-2.5-flash` est resté dans
> la liste des modèles disponibles après son retrait, et seul un appel réel
> le révèle. Le mode `diagnose` ci-dessous vérifie la clé, pas la vie du
> modèle.

Pour voir la liste complète des modèles autorisés par votre clé, sans passer
par l'app (remplacez `VOTRE_REF` et `VOTRE_ANON_KEY`, tous deux dans `.env`) :

```
curl -X POST "https://VOTRE_REF.supabase.co/functions/v1/coach" ^
  -H "Authorization: Bearer VOTRE_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"diagnose\":true}"
```

La réponse liste `availableModels`. Aucune donnée de trading n'est envoyée et
le modèle n'est pas appelé : c'est une simple interrogation de catalogue.

> **Attention** : ce catalogue n'est pas fiable à 100 %. `gemini-2.5-flash`
> y est resté listé plusieurs jours après avoir cessé de fonctionner. Un
> identifiant présent dans la liste est un *candidat*, pas une garantie — la
> seule preuve qu'un modèle marche est un appel réussi.

Ancienne méthode, si besoin :

```
npx supabase secrets set GEMINI_MODEL=gemini-flash-latest
npx supabase functions deploy coach
```

Les identifiants disponibles sont listés sur
<https://ai.google.dev/gemini-api/docs/models>.

---

## Ce que la synthèse affichera

Un court paragraphe reliant vos observations (tilt, heure coûteuse, meilleur
setup) en un seul constat, plus une action prioritaire.

**Sans aucun chiffre**, volontairement. Un modèle à qui l'on demande un taux
de réussite en invente un avec assurance, et un journal de trading qui affiche
des statistiques inventées vaut moins que pas de journal. Tous les chiffres à
l'écran viennent du calcul fait sur votre téléphone.

Ce qui est envoyé : uniquement des identifiants d'observations anonymes et des
ratios. Aucun trade, prix, horodatage, instrument, note ni solde.
