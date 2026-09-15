# Seven Journal

> Bloomberg-inspired quantitative trading terminal mobile app

[![React Native](https://img.shields.io/badge/React%20Native-0.86.2-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-black.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-green.svg)](https://supabase.com/)

## 📱 Description

Seven Journal est un terminal de trading quantitatif mobile qui combine journal de trades, analytics avancés, tracker de prop firm, et outils de discipline. Il existe pour aider les traders à comprendre leur performance, respecter leurs règles, et améliorer leur edge — le tout dans une expérience visuelle premium inspirée des terminaux Bloomberg.

## ✨ Fonctionnalités

### 📊 Dashboard
- KPIs en temps réel (P&L, Win Rate, Profit Factor, R-Multiple)
- Courbe d'équité interactive avec tooltip
- P&L quotidien bicolore (vert/rouge)
- Streak tracker (win/loss consécutifs)
- Account Health Badge
- Market Sessions (Tokyo, Londres, New York, Sydney)
- Session Timer avec Lock Guard

### 📈 Analytics
- **Vue d'ensemble** : KPIs globaux, Expectancy R-score
- **Equity & Drawdown** : Courbe d'équité, courbe de drawdown
- **Distribution** : Pie chart gains/pertes
- **Breakdown** : Par setup, par paire, par timeframe
- **Timing** : Performance par heure et par jour
- **Psychology** : Impact du mental sur le P&L
- **Prop Firm Tracker** : Drawdown projection, consistency rule, countdown

### 📅 Calendrier
- Heatmap mensuelle avec drill-down par jour
- Détail des trades par date
- Stats mensuelles (P&L, jours actifs)

### 📓 Playbook
- Stratégies personnalisées (FVG, BOS, OB, etc.)
- Débriefings quotidiens
- Scores mentaux et notes
- Matrice de discipline

### 💰 Comptes
- Gestion multi-comptes (Prop Firm, Personnel, Démo)
- Lock Guard automatique (daily loss limit)
- Prop Firm Tracker (drawdown, consistency, target)
- Progress bar des objectifs

### 🎯 Outils
- **Position Calculator** : Lot sizing multi-instruments
- **Achievements** : 13 badges progressifs
- **Share Card** : Export P&L en image
- **Import/Export** : MT4/MT5, TradingView, CSV

## 🛠️ Stack Technique

| Technologie | Usage |
|-------------|-------|
| React Native 0.86 | Framework mobile |
| Expo SDK 57 | Build & tooling |
| Supabase | Auth + BDD + RLS |
| TanStack React Query | State management (server) |
| Zustand | State management (client) |
| react-native-reanimated | Animations |
| react-native-svg | Charts custom |
| lucide-react-native | Icônes |

## 🎨 Design System

- **Dark Mode OLED** : Fond #07080a
- **Palette** : Indigo (actions) / Vert (gains) / Rouge (pertes) / Or (prop firm)
- **Typography** : JetBrains Mono (données) + Plus Jakarta Sans (UI)
- **Composants** : Card, Badge, KpiCard, StatRow, BicolorBarChart, GlowingEquityAreaChart

## 📦 Installation

```bash
# Cloner le repo
git clone https://github.com/Andryni/seven-journal-mobile.git
cd seven-journal-mobile

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec tes clés Supabase

# Lancer en dev
npx expo start
```

## ⚙️ Configuration

### 1. Variables d'environnement

Créer un fichier `.env` à la racine :

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

Les deux valeurs se trouvent dans Supabase → Settings → API (`Project URL` et
la clé `anon` / `public`). Sans elles l'app démarre mais chaque écran reste
vide : le client Supabase le signale dans la console au lancement.

`.env` est gitignoré. Les variables `EXPO_PUBLIC_*` sont lues au démarrage de
Metro : après toute modification, relancer avec `npx expo start -c`, sinon
l'ancienne valeur reste dans le cache.

### 2. Base de données

**À faire aussi sur une base existante**, pas seulement à la première
installation : Supabase Dashboard → SQL Editor → coller `supabase/schema.sql` →
Run.

Ce fichier est idempotent et se re-joue sans risque. Il ajoute les colonnes
introduites depuis (`instrument_type`, `timezone`, `challenge_end_date`,
`lock_code`…) via `add column if not exists`. Si la base n'est pas à jour,
l'app se charge mais échoue sur les écrans qui lisent ces colonnes.

### 3. Synthèse IA (optionnel)

L'app fonctionne entièrement sans. Voir `supabase/functions/coach/README.md`
pour l'activer.

## 🧪 Tester sur Expo Go

```bash
npm install
npx expo start
```

Scanner le QR code avec Expo Go (Android) ou l'app Appareil photo (iOS).
Le téléphone et l'ordinateur doivent être sur le **même réseau Wi-Fi**.

Ce projet est en **SDK 57** : il faut une version d'Expo Go compatible SDK 57.
Expo Go ne conserve qu'un seul SDK à la fois, donc une version installée pour
un projet plus ancien affichera une erreur de version incompatible — il suffit
de la mettre à jour depuis le store.

Si le QR code ne passe pas (Wi-Fi d'entreprise, isolation des clients, VPN) :

```bash
npx expo start --tunnel
```

Fonctionnalités indisponibles dans Expo Go, et seulement celles-là — le reste
de l'app est testable normalement :

| Fonctionnalité | Comportement dans Expo Go |
|---|---|
| Notifications | Entièrement désactivées, l'interrupteur explique pourquoi |
| Face ID / déverrouillage biométrique | Indisponible, l'écran se contourne |

Depuis le SDK 53, `expo-notifications` lève une exception **au moment de son
import** dans Expo Go. L'app charge donc le module via
`src/features/notifications/notificationsModule.ts`, qui ne l'évalue pas du
tout dans Expo Go. Sans cette précaution l'app entière crashe au démarrage sur
`[runtime not ready]`.

Pour les tester, il faut un development build (`npx expo run:android`).

### En cas de problème

| Symptôme | Cause habituelle |
|---|---|
| Écrans vides, aucune donnée | `.env` absent ou Metro non relancé avec `-c` |
| Erreur SQL sur une colonne | `supabase/schema.sql` pas re-joué |
| « incompatible SDK version » | Expo Go à mettre à jour (SDK 57) |
| QR code sans effet | Réseaux différents → `npx expo start --tunnel` |

## 📱 Scripts

```bash
npm start          # Lancer Expo
npm run android    # Lancer sur Android
npm run ios        # Lancer sur iOS
npm run web        # Lancer sur Web
npm test           # Lancer les tests
```

## 🗂️ Structure du Projet

```
src/
├── api/                 # Client Supabase
├── assets/              # Images, logos
├── components/
│   ├── analytics/       # SessionHeatmapCard
│   ├── common/          # TopAccountBar, AnimatedSplashScreen, ErrorBoundary
│   ├── dashboard/       # ChecklistCard, AchievementsCard
│   ├── share/           # ShareCardModal, ExportPngButton
│   ├── trades/          # TradeFormModal, TradeDetailModal, PositionCalculator
│   └── ui/              # Card, Badge, KpiCard, BicolorBarChart, GlowingEquityAreaChart
├── features/
│   ├── accounts/        # useAccounts
│   ├── dashboard/       # usePerformanceMetrics, useChecklist
│   ├── guard/           # useDailyLock
│   ├── playbook/        # usePlaybook
│   └── trades/          # useTrades
├── i18n/                # Traductions FR/EN
├── screens/             # Dashboard, Trades, Calendar, Analytics, Playbook, Accounts
├── store/               # Zustand stores (toast, ui)
├── theme/               # Design tokens, thème dark/light
├── types/               # Types TypeScript
└── utils/               # formatCurrency, financials, importParsers
```

## 🌐 Internationalisation

Support FR/EN avec `useT()` hook. Toggle accessible depuis la TopBar.

## 📄 Licence

MIT

---

**Seven Journal** — Terminal de trading quantitatif mobile 🚀
