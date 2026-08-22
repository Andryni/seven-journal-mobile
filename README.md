# Seven Journal

> Bloomberg-inspired quantitative trading terminal mobile app

[![React Native](https://img.shields.io/badge/React%20Native-0.86.2-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-black.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-green.svg)](https://supabase.com/)

## 📱 Description

Seven Journal est un terminal de trading quantitatif mobile qui combine journal de trades, analytics avancés, tracker de prop firm, et outils de discipline. Il existe pour aider les traders à comprendre leur performance, respecter leurs règles, et améliorer leur edge — le tout dans une expérience visuelle premium inspirée des terminaux Bloomberg.

## ✨ Fonctionnalités

### 📸 Saisie Ultra-Rapide & Scan IA
- **Scan IA de Captures d'Écran (Gemini 1.5 Flash Vision)** : Import instantané depuis vos captures MT4/MT5/TradingView (extraction automatique de la Paire, Volume/Lots, Prix d'Entrée, SL, TP, Sortie et P&L).
- **Floating Action Button (FAB) Global** : Ajout rapide de trade accessible en 1 tap depuis n'importe quel écran.
- **Sélecteur de Risque Rapide** : Chips de préréglage de risque (0.5%, 1%, 2%) et alerte de dépassement de risque.

### 📊 Dashboard & Lock Guard
- **KPIs en temps réel** (P&L, Win Rate, Profit Factor, Expectancy, R-Multiple moyen).
- **Courbe d'équité interactive** & Bicolor Daily P&L.
- **Hard Daily Lock Overlay** : Verrouillage d'écran anti-revenge trading immédiat lorsque le Max Daily Drawdown est atteint.
- **Suivi des sessions de marché** (Asie, Londres, New York, Over Session).

### 📈 Analytics & Psychologie
- **Diagnostics & Impact Mental** : Corrélations statistiques automatiques entre vos émotions avant/après trade (FOMO, Revenge, Calme) et votre winrate.
- **Simulateur What-If** : Simulation en direct du P&L théorique si toutes vos pertes avaient été rigoureusement coupées à -1R.
- **Matrice Croisée Sessions × Jours** : Analyse matricielle 4 sessions × 5 jours pour détecter vos créneaux les plus rentables.
- **Prop Firm Tracker** : Projection de Drawdown, règle de consistance, compte à rebours de challenge.

### 📓 Playbook & Matrice de Discipline 2.0
- **Stratégies de trading (Setups)** avec validation technique personnalisée (FVG, BOS, Sweeps, etc.).
- **Débriefing Journalier avec DatePicker Natif** localisé en FR / EN.
- **Liaison dynamique des règles** : Le débriefing vérifie vos vraies règles issues de vos stratégies.
- **Score de Discipline Global (0 à 100%)** et compteur de jours sans infraction (**Clean Days Streak** 🔥).
- **Leak Detector** : Récidive des fautes et suivi statistique des erreurs de trading.

### 💰 Gestion Multi-Comptes (Futures & CFD)
- **Support complet CFD & Futures** (E-mini / Micro, contrats, calculs de ticks).
- **Suivi des challenges Prop Firm** (FTMO, Topstep, etc.) et portefeuilles personnels.

### 🎯 Outils & Imports
- **Position & Risk Calculator** : Calcul de lot sizing multi-instruments.
- **Import/Export** : MT4/MT5 (CSV/HTML), TradingView et exports de données.
- **Share Card Generator** : Partage élégant de vos performances en image.

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

Créer un fichier `.env` à la racine :

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key  # Gratuit (pour le Scan IA)
```

### 🗄️ Base de Données Supabase
Exécutez le script SQL fourni [`supabase_migration_complete.sql`](./supabase_migration_complete.sql) dans votre **SQL Editor Supabase** pour initialiser les tables (Daily Lock, Futures, Débriefings, Index de performance).

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
