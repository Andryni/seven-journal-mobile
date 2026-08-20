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

Créer un fichier `.env` :

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

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
