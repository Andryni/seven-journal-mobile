# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

- **Prop firm traders** — traders en challenge ou funded, gérant des comptes prop firms (FTMO, FundedNext, etc.) avec des règles strictes (daily loss limit, max drawdown, consistency rule). Ils ont besoin d'un tracking précis de leurs limites et d'un garde-fou automatique.
- **Individual traders** — traders personnels sans contraintes prop firm, qui veulent journaliser, analyser et améliorer leur trading. Ils veulent un outil de suivi complet sans les garde-fous prop firm.

## Product Purpose

Seven Journal est un terminal de trading quantitatif mobile qui combine journal de trades, analytics avancés, tracker de prop firm, et outils de discipline. Il existe pour aider les traders à comprendre leur performance, respecter leurs règles, et améliorer leur edge — le tout dans une expérience visuelle premium inspirée des terminaux Bloomberg.

## Positioning

Le combo unique : un **design terminal Bloomberg** (dark OLED, animations, ticker live, tabular nums) + un **prop firm tracker intégré** (lock guard, consistency rule, drawdown projection) + une **app mobile native** avec sync Supabase. Aucun concurrent (Edgewonk, TraderSync, Myfxbook) n'offre cette combinaison dans une app mobile native.

## Operating Context

- Le trader utilise l'app **après chaque session de trading** pour journaliser ses positions
- Il consulte le **dashboard** pour voir sa performance globale en temps réel
- Il utilise l'**analytics** pour identifier ses forces/faiblesses (sessions, timeframes, setups, état mental)
- Il gère ses **comptes prop firm** avec les garde-fous automatiques (daily loss lock)
- Il consulte son **playbook** pour ses setups et débriefings quotidiens
- L'app doit fonctionner **offline** avec sync différée quand le réseau revient
- Les données sensibles (trades, P&L) doivent être **protégées par RLS** Supabase

## Capabilities and Constraints

**Fonctionnalités confirmées :**
- Journal de trades (CRUD, import MT4/MT5/TradingView, export CSV)
- Dashboard avec KPIs, courbe d'équité, P&L daily, streak tracker
- Analytics multi-onglets (overview, equity, distribution, breakdown, timing, psychology, prop firm)
- Calendrier heatmap avec drill-down par jour
- Playbook avec setups stratégiques et débriefings quotidiens
- Gestion de comptes (prop firm, personnel, démo) avec prop firm tracker
- Position calculator (lot sizing multi-instruments)
- Achievements/gamification (13 badges progressifs)
- Share card (export P&L en image)
- i18n FR/EN complet
- Thème dark/light persisté (Zustand + AsyncStorage)

**Contraintes techniques :**
- React Native via Expo SDK 57
- Backend Supabase (auth + BDD + RLS)
- State management : TanStack React Query + Zustand
- Animations : react-native-reanimated
- Charts : SVG custom (GlowingEquityAreaChart, BicolorBarChart) + PieChart react-native-chart-kit
- Fonts : JetBrains Mono (données) + Plus Jakarta Sans (UI)

**Décisions ouvertes :**
- Monétisation (freemium, abonnement, one-time purchase)
- Fonctionnalités sociales (classements, partage, copy trading)
- Intégration temps réel avec MT4/MT5 (webhook, API)
- Notifications push

## Brand Commitments

- **Nom** : Seven Journal
- **Voice** : Bloomberg-style — technique, direct, sans fioritures. Labels en UPPERCASE mono pour les données, sans serif pour l'UI.
- **Palette** : Dark OLED (#07080a) + Indigo (#6366f1) comme couleur de marque + Vert/Rouge pour P&L + Or pour prop firm
- **Personnalité** : Terminal high-tech, pas un simple journal. Chaque écran doit se sentir comme un cockpit de trading.
- **Logo** : PNG existant (`src/assets/seven_tracking_logo.png`) — à préserver

## Evidence on Hand

- Design System complet documenté dans `design-system/seven-tracking/MASTER.md`
- 6 écrans fonctionnels (Dashboard, Trades, Calendar, Analytics, Playbook, Accounts)
- 11 composants UI réutilisables (Card, Badge, KpiCard, StatRow, BicolorBarChart, GlowingEquityAreaChart, etc.)
- 5 hooks features (useTrades, useAccounts, usePlaybook, useDailyLock, useChecklist)
- 2 fichiers de tests (financials, formatCurrency)
- Migrations Supabase (2 fichiers SQL)
- README avec badges

## Product Principles

1. **Data-first** — les chiffres financiers sont l'élément principal, jamais sacrifiés au design
2. **Terminal, pas journal** — chaque écran doit se sentir comme un cockpit de trading Bloomberg
3. **Lock Guard sacré** — les garde-fous prop firm ne doivent jamais être contourés
4. **Offline-resilient** — l'app doit fonctionner sans réseau avec sync différée
5. **Mobile-native** — pas un wrapper web, des animations natives, des gestures natifs

## Accessibility & Inclusion

- Accessibilité native : `accessibilityLabel` sur tous les boutons icônes, `hitSlop` ≥ 8px
- Contraste WCAG AA pour le texte essentiel
- Labels min 9px pour les éléments critiques
- Chiffres financiers en `tabular-nums` pour l'alignement
