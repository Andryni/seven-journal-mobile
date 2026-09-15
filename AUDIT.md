# Audit Seven Journal Mobile — Avis & Plan d'upgrade

> Audit réalisé avant toute modification de code. Base : commit `33c2de2`, ~17 200 lignes TS/TSX, Expo SDK 57 / RN 0.86 / Supabase / React Query / Zustand.

---

## 1. Ce qui est bon (à garder absolument)

| Point fort | Détail |
|---|---|
| **Stack moderne et saine** | Expo 57, RN 0.86, React Query + Zustand (bonne séparation server-state / UI-state), Reanimated 4, SVG custom au lieu d'une lib de charts lourde. |
| **Thème centralisé** | `src/theme/index.ts` avec `Theme` typé, dark/light persisté, pattern `createStyles(theme)`. Beaucoup de projets n'ont pas ça. |
| **i18n complet FR/EN** | 1 200 lignes de traductions, `useT()` propre. Rare et précieux. |
| **Domaine métier réellement pensé** | `Trade` avec R-multiple, session, mental_state, setups ICT (FVG, OB, liquidity sweep), bookmap. Ce n'est pas un CRUD générique. |
| **Prop firm tracker + Lock Guard** | Vrai différenciateur. `useDailyLock` + calcul de daily loss côté mutation = garde-fou difficilement contournable. |
| **Charts maison** | `GlowingEquityAreaChart`, `BicolorBarChart`, `DonutChart` en SVG = contrôle total, pas de dépendance morte. |
| **Docs** | PRODUCT.md, DESIGN.md, MASTER.md — la direction produit est écrite, pas seulement dans la tête. |
| **Tests utilitaires** | financials, formatCurrency, formatDate, importParsers. Le noyau de calcul est couvert. |

---

## 2. Ce qui ne va pas

### 2.1 Design — pourquoi ça fait « généré par IA »

C'est le point le plus important, et le diagnostic est précis :

1. **Palette par défaut de Tailwind.** `#6366f1` indigo, `#10b981` emerald, `#ef4444` red, `#f59e0b` amber, `#06b6d4` cyan — ce sont littéralement `indigo-500`, `emerald-500`, `red-500`, `amber-500`, `cyan-500`. Toute app générée par un LLM depuis 2023 a exactement ces hex. Aucune signature visuelle.
2. **L'indigo ne veut rien dire pour un trader.** Bloomberg = ambre sur noir. Les terminaux pros = orange/ambre, cyan froid, blanc. L'indigo, c'est du SaaS B2B, pas du cockpit.
3. **Effet « glow » partout.** Halos, `shadowRadius`, `Glowing...Chart`, gradients sur chaque carte. Le glow = decoration, or le design system dit lui-même « color = semantic meaning, never decorative ». La règle est écrite puis violée.
4. **Tout est une carte arrondie 18 px avec gradient.** 6 écrans, ~30 cartes, toutes identiques. Résultat : pas de hiérarchie visuelle. Un vrai terminal a des **zones**, des **règles (rules) fines**, des **tableaux denses** — pas des cartes flottantes.
5. **Emoji comme icônes de badges** (`🚀 📊 💼 ✅ 🎯`) alors que DESIGN.md interdit explicitement les emoji. Incohérence + rendu différent iOS/Android.
6. **Sur-décoration du Dashboard.** Ticker marquee + hero gradient + sparkles + achievements + checklist + calculator + risk gauge + market sessions… sur un seul scroll. C'est un fil d'actu, pas un cockpit. Un trader veut 3 chiffres en 1 seconde.
7. **Typo sous-exploitée.** JetBrains Mono + Plus Jakarta Sans = combo correct mais ultra-vu. Et la majorité des tailles sont 9–12 px : dense sans être hiérarchisé, tout a le même poids visuel.
8. **145 `rgba(...)` et 32 hex codés en dur dans les composants**, malgré la règle « Don't use hex colors in components ». Le light mode est donc forcément cassé par endroits.

### 2.2 Architecture & code

| Problème | Impact |
|---|---|
| **Écrans monolithiques** : `AnalyticsScreen` 1 525 l., `TradeFormModal` 1 305 l., `PlaybookScreen` 1 130 l., `AccountsScreen` 1 057 l. | Impossible à maintenir, à tester, re-render massifs. |
| **`AnalyticsScreen` = 7 onglets dans un seul fichier**, tous montés dans le même composant. | Tout se recalcule à chaque changement d'onglet. |
| **Pas de navigation stack** — 6 onglets bottom tabs, tout est modal. | 6 tabs = 1 de trop pour du mobile (guideline : 5 max). Pas de deep-link, pas de détail en push. |
| **`LiveTickerBanner` appelle `useTrades()`** indépendamment du Dashboard. | Le « ticker live » n'affiche que tes 10 derniers trades, pas des prix live. **C'est un faux live.** Promesse trompeuse. |
| **Offline annoncé mais inexistant.** PRODUCT.md dit « offline-resilient », aucun `persistQueryClient`, aucun NetInfo, aucune mutation queue. | Feature fantôme. |
| **Playbook en AsyncStorage** avec fallback Supabase bricolé. | Pas de sync multi-device, données perdues à la désinstallation. |
| **`checkAndApplyDailyLock` rejoué à chaque mutation** côté client. | Logique critique côté client = contournable. Devrait être un trigger/RPC Postgres. |
| **Message de lock hardcodé en français** dans `useTrades.ts`. | Casse l'i18n. |
| **Seulement 2 migrations SQL** pour ~15 champs de compte. | Le schéma réel n'est pas versionné → impossible de recréer la base. |
| **9 `console.*` en prod**, `: any` résiduels, un fichier parasite nommé `idth width as any,` à la racine. | Négligence visible. |

### 2.3 Features à supprimer ou repenser

- **Achievements / 13 badges gamification** → hors-sujet pour un outil pro. Un trader prop firm ne veut pas de 🏆. À supprimer, ou à transformer en *Discipline Score* chiffré (métrique, pas trophée).
- **LiveTickerBanner** → soit on branche de vrais prix (API), soit on supprime. En l'état c'est du bruit décoratif.
- **AnimatedSplashScreen** → 255 lignes pour retarder l'app. À réduire drastiquement.
- **PositionCalculator sur le Dashboard** → bon outil, mauvais endroit. Il sert *avant* le trade, pas dans le récapitulatif.
- **7 onglets Analytics** → à fusionner en 3–4 vues réellement distinctes.
- **Bookmap fields (absorption, passive/aggressive orders, VWAP)** → 4 champs très niche qui alourdissent le formulaire pour 95 % des users. À passer en section optionnelle repliée.
- **Formulaire de trade à ~20 champs** → premier facteur d'abandon d'un journal. Doit être scindé : saisie rapide (6 champs, 15 s) + enrichissement différé.

---

## 3. Suggestions d'upgrade

### 3.1 Refonte visuelle — direction proposée : **« Trading Desk, pas SaaS »**

Objectif : sortir de la palette Tailwind et de la carte-gradient-glow.

- **Nouvelle palette signature**
  - Fond : `#0A0A0B` → `#101013` (neutre chaud, pas bleu-violet)
  - **Accent marque : ambre/amber cuivré `#FF9F1C` type phosphore de terminal** — hérité de Bloomberg, immédiatement crédible dans la finance, et *différenciant* vs l'indigo générique.
  - P&L : vert `#2BD576` désaturé / rouge `#FF4D4D` — mais **appliqués uniquement au texte et aux barres, jamais en fond**.
  - Neutres : une vraie échelle 9 niveaux, tintée chaud.
- **Supprimer tous les glows**, remplacer par : *hairlines* 1 px, séparateurs, et un seul niveau d'élévation.
- **Passer de « cartes » à « panneaux »** : coins 8–10 px max, pas de gradient, bordure `rgba(255,255,255,0.06)`, fond plat. Le contraste vient de la typo, pas des ombres.
- **Grille de données réelle** dans Trades : lignes denses, colonnes alignées tabular-nums, séparateurs fins — comme un blotter. C'est ça qui fait « pro ».
- **Hiérarchie typographique forte** : un chiffre héros à 34–40 px, des labels 10 px uppercase tracking large, et *rien entre les deux*. Aujourd'hui tout est à 9–16 px.
- **Typo** : garder JetBrains Mono pour les chiffres (excellent choix), remplacer Plus Jakarta Sans par quelque chose de plus neutre/technique (Inter tight ou Geist) pour éviter l'effet « template Figma ».
- **Un seul mode : dark.** Le light mode d'une app de trading est peu utilisé, à moitié cassé ici, et double le coût de chaque écran. Proposition : le retirer (ou le finir correctement — mais c'est du temps pris sur le reste).
- **Icônes** : lucide partout, suppression totale des emoji.

### 3.2 Features à ajouter (par valeur décroissante)

1. **Quick Trade Entry** — sheet de saisie en 6 champs (paire, sens, entry, SL, TP, size) avec R-multiple calculé en direct, et un bouton « compléter plus tard ». Le reste (psycho, setup, screenshots) se remplit depuis le détail du trade. C'est *le* levier de rétention d'un journal.
2. **Risk-first : le calculateur intégré au formulaire.** Tu saisis SL + risque % → la taille de position est proposée automatiquement. Fusionne PositionCalculator avec TradeFormModal au lieu de les garder séparés.
3. **Vrai offline** — `@tanstack/query-persist-client` + AsyncStorage + file de mutations rejouées à la reconnexion + indicateur de sync. Ça tient la promesse déjà écrite dans PRODUCT.md.
4. **Rule Engine prop firm côté serveur** — daily loss, max drawdown (static & trailing), consistency rule, jours restants, calculés dans une RPC Postgres. Plus fiable, plus rapide, non contournable.
5. **Pre-trade Guard** — avant de valider un trade, l'app affiche : risque restant aujourd'hui, distance au daily loss, respect du plan. Bloque si la session est locked. C'est la traduction concrète du principe « Lock Guard sacré ».
6. **Review hebdomadaire** — un écran « semaine » qui sort automatiquement : meilleur/pire setup, meilleure session, erreur récurrente, evolution du R moyen. Transforme le journal en outil d'amélioration plutôt qu'en archive.
7. **Discipline Score (0–100)** — remplaçant des achievements : respect du risque, respect de la checklist, absence de revenge trading, sur-trading. Une métrique, affichée à côté du P&L.
8. **Notifications locales** — rappel de journalisation en fin de session, alerte à 70 % du daily loss, rappel de debrief hebdo. `expo-notifications`, faible coût, forte rétention.
9. **Biométrie (Face ID)** au lancement — données financières, attendu sur ce type d'app.
10. **Screenshots de trades exploitables** — upload Supabase Storage + viewer plein écran avec zoom. Aujourd'hui les URLs existent dans le type mais l'UX est faible.

### 3.3 Nettoyage technique

- Découper `AnalyticsScreen` en 4 sous-écrans lazy, `TradeFormModal` en sections.
- Passer de 6 à **5 onglets** : Dashboard · Trades · Calendar · Analytics · Plus (Playbook, Accounts, Settings dans un stack).
- Sortir les 145 `rgba()` et 32 hex dans le thème.
- Supprimer le fichier parasite `idth width as any,`, les `console.*`, les `any`.
- Écrire un **schema.sql complet** + migrations ordonnées.
- Tests : ajouter des tests sur `usePerformanceMetrics` et le rule engine prop firm (le cœur métier n'est testé qu'en surface).

---

## 4. Plan d'exécution proposé (par lots livrables)

| Lot | Contenu | Pourquoi d'abord |
|---|---|---|
| **1 — Identité visuelle** | Nouveau thème (palette ambre/neutres chauds), nouvelle typo, suppression des glows, primitives `Panel` / `DataRow` / `Metric` / `Hairline`, refonte de la tab bar. | Change l'impression en 5 secondes, et tout le reste s'appuie dessus. |
| **2 — Dashboard & Trades** | Dashboard réduit à l'essentiel (3 KPI héros + equity + risque du jour + derniers trades), Trades en blotter dense avec filtres. | Les 2 écrans utilisés 90 % du temps. |
| **3 — Saisie & risque** | Quick Trade Entry, calculateur fusionné, Pre-trade Guard. | Le levier produit le plus fort. |
| **4 — Nettoyage & suppressions** | Achievements, faux ticker, splash allégé, découpage Analytics, purge des hex. | Moins de bruit, code sain. |
| **5 — Fiabilité** | Offline + sync, rule engine serveur, notifications, biométrie, schema.sql, tests. | Passe du prototype au produit. |

---

### En une phrase

Le **produit** est bon et le domaine métier est sérieusement pensé — le problème n'est pas l'idée, c'est que l'exécution visuelle utilise la palette et les tics (glow, cartes gradient, emoji, ticker décoratif) qui signent une génération IA, et que plusieurs promesses (offline, live, Bloomberg) ne sont pas tenues dans le code. La bascule vers un vrai langage « trading desk » plus une saisie rapide orientée risque suffirait à faire passer l'app pour un outil pro.
