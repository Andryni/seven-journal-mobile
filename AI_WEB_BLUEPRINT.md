# 🌐 SEVEN JOURNAL — WEB VERSION MASTER BLUEPRINT & ARCHITECTURE SPECIFICATION
> **Document de Spécification Technique & Fonctionnelle Exhaustif pour Agent IA**  
> *Ce document contient toutes les informations nécessaires (Architecture, Base de Données, Algorithmes Métier, UI/UX, Fonctionnalités, Prompts IA) pour générer et développer l'application Web moderne de Seven Journal.*

---

## 📑 TABLE DES MATIÈRES
1. [Vision & Positionnement Produit](#1-vision--positionnement-produit)
2. [Stack Technique Recommandée pour le Web](#2-stack-technique-recommandée-pour-le-web)
3. [Architecture de la Base de Données (Supabase PostgreSQL)](#3-architecture-de-la-base-de-données-supabase-postgresql)
4. [Moteur de Calculs Mathématiques & KPIs Quantitatifs](#4-moteur-de-calculs-mathématiques--kpis-quantitatifs)
5. [Modules & Fonctionnalités Clés à Implémenter](#5-modules--fonctionnalités-clés-à-implémenter)
6. [Système de Design & Thème Sombre Fintech](#6-système-de-design--thème-sombre-fintech)
7. [Internationalisation (i18n FR / EN)](#7-internationalisation-i18n-fr--en)
8. [Guide d'Exécution Pas-à-Pas pour l'Agent IA](#8-guide-dexécution-pas-à-pas-pour-lagent-ia)

---

## 1. VISION & POSITIONNEMENT PRODUIT

**Seven Journal** est un terminal de trading quantitatif et journal de bord de performance financière conçu pour les traders indépendants et prop traders institutionnels (*Forex, Crypto, Indices, Matières Premières*).

### Piliers Fondamentaux :
1. **Rigueur & Discipline Quantitative :** Traquer les setups, ratios Risque/Rendement (R:R), absorptions Bookmap/Order Flow et sessions de liquidité (*Asia, London, New York*).
2. **Gestion du Risque & Anti-Revenge Trading :** Hard Daily Lock automatique dès que la perte maximale journalière est atteinte.
3. **Psychologie & Corrélations Émotionnelles :** Détecter l'impact du FOMO, de la cupidité et de la fatigue sur le winrate.
4. **Assistance IA (Gemini Vision) :** Extraction automatique des données de trades depuis les captures d'écran TradingView / MetaTrader.

---

## 2. STACK TECHNIQUE RECOMMANDÉE POUR LE WEB

Pour offrir une expérience de bureau fluide, ultra-réactive et digne d'un terminal de trading Bloomberg/TradingView :

* **Framework :** Next.js 15 (App Router) ou Vite + React 19 + TypeScript
* **Styling & UI :** TailwindCSS v4 + Shadcn/UI + Lucide React
* **Graphiques Financiers :** Lightweight Charts (TradingView) pour les chandeliers/courbes d'equity + Recharts pour les métriques analytiques & heatmaps
* **Gestion d'État & Requêtage :** Zustand (UI & sessions) + @tanstack/react-query (Cache serveur & invalidations)
* **Backend & Authentification :** Supabase (Auth, PostgreSQL, Realtime, Storage pour les screenshots)
* **IA & Vision :** @google/genai (SDK officiel Google Gemini 1.5 Flash Vision)
* **Export & Partage :** html-to-image / canvas pour exporter des cartes de partage P&L élégantes

---

## 3. ARCHITECTURE DE LA BASE DE DONNÉES (SUPABASE POSTGRESQL)

### Schéma DDL Complet (Prêt à exécuter) :

\\\sql
-- 1. Table des Comptes de Trading
CREATE TABLE public.trading_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('challenge', 'funded', 'personal', 'demo')) DEFAULT 'funded',
    currency TEXT DEFAULT 'USD',
    initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table des Trades
CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE NOT NULL,
    pair TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('BUY', 'SELL')) NOT NULL,
    entry_price NUMERIC(15, 5) NOT NULL,
    exit_price NUMERIC(15, 5),
    stop_loss NUMERIC(15, 5) NOT NULL,
    take_profit NUMERIC(15, 5) NOT NULL,
    size NUMERIC(10, 2) NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    exit_time TIMESTAMPTZ,
    pnl NUMERIC(15, 2),
    r_multiple NUMERIC(8, 2),
    timeframe TEXT CHECK (timeframe IN ('M1', 'M5', 'M15', 'H1', 'H4', 'D1')) DEFAULT 'M15',
    session TEXT CHECK (session IN ('Asia', 'London', 'New York', 'Over Session', '')) DEFAULT '',
    result TEXT CHECK (result IN ('TP', 'SL', 'BE', 'OPEN')) DEFAULT 'OPEN',
    mental_state TEXT CHECK (mental_state IN ('focused', 'anxious', 'greedy', 'revenge', 'fomo', 'tired')) DEFAULT 'focused',
    setup_structures TEXT[] DEFAULT '{}',
    setup_fvg BOOLEAN DEFAULT false,
    setup_ob BOOLEAN DEFAULT false,
    setup_liquidity_sweep BOOLEAN DEFAULT false,
    bookmap_absorption TEXT,
    bookmap_passive_orders TEXT,
    bookmap_aggressive_orders TEXT,
    bookmap_vwap_position TEXT CHECK (bookmap_vwap_position IN ('above', 'below', 'at', NULL)),
    rule_40_percent BOOLEAN DEFAULT false,
    cookie_jar_ref BOOLEAN DEFAULT false,
    screenshot_before_url TEXT,
    screenshot_after_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table du Playbook & Setups
CREATE TABLE public.playbook_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB DEFAULT '[]',
    rules_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Table des Débriefings Quotidiens (Daily Debriefs)
CREATE TABLE public.daily_debriefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clean_day BOOLEAN DEFAULT true,
    score INT CHECK (score >= 0 AND score <= 100) DEFAULT 100,
    broken_rules JSONB DEFAULT '[]',
    mental_state TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Table de Verrouillage Journalier (Hard Daily Lock)
CREATE TABLE public.daily_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    is_locked BOOLEAN DEFAULT true,
    max_daily_loss NUMERIC(15, 2) DEFAULT 500.00,
    current_loss NUMERIC(15, 2) DEFAULT 0.00,
    reason TEXT,
    locked_at TIMESTAMPTZ DEFAULT now()
);
\\\

---

## 4. MOTEUR DE CALCULS MATHÉMATIQUES & KPIS QUANTITATIFS

L'agent IA doit intégrer exactement les formules de performance suivantes (cf. src/features/analytics/useAnalyticsComputations.ts) :

### 1. Métriques Financières de Base
* **Win Rate (%) :** (Gagnants / Total Fermés) * 100
* **Profit Factor :** Somme(Gains) / Somme(|Pertes|)
* **Expected Value (Espérance Mathématique par Trade) :**
  EV = (WinRate * Avg Win) - (LossRate * Avg Loss)
* **Ratio Risque / Récompense Moyen (Avg R:R) :** Somme(r_multiple) / Nombre de trades
* **Max Drawdown ($ & %) :** Perte maximale enregistrée depuis le sommet historique de la courbe d'equity.

### 2. Matrice de Discipline 2.0
* **Discipline Score (0-100%) :** (1 - (Règles transgressées / Total règles)) * 100
* **Clean Days Streak :** Nombre de jours consécutifs avec 100% de respect des règles (0 faute).

### 3. Diagnostics Psychologiques
* Corrélations croisées entre chaque émotion (Focused, FOMO, Revenge, Greedy, Anxious, Tired) et son Winrate/P&L moyen associé pour identifier les fuites de capital.

---

## 5. MODULES & FONCTIONNALITÉS CLÉS À IMPLÉMENTER

### Module A : Dashboard Trading Pro (Desktop Multi-Colonnes)
1. **Barre de Sessions de Marché Live :**
   * **Asia :** 00:00 – 09:00 UTC (Pill live avec voyant vert/rouge).
   * **London :** 07:00 – 16:00 UTC.
   * **New York :** 12:00 – 21:00 UTC.
   * Timer de session actif avec décompte.
2. **KPIs Cards Synthétiques :** Net P&L (avec badges % évolution), Winrate, Profit Factor, R:R Moyen, Nombre de trades du jour.
3. **Courbe d'Equity Lumineuse (Glowing Equity Chart) :** Évolution du solde avec dégradé vert émeraude / indigo.
4. **Live Ticker Banner :** Bandeau défilant des derniers trades exécutés en direct.

### Module B : Journal des Positions (Data Table & Filtres)
1. **Filtres Avancés :** Par Session (Asia, London, New York), Période (Aujourd'hui, 7j, 30j, 90j, Tout), Résultat (TP, SL, BE, OPEN), Compte actif.
2. **Scanner IA de Screenshots (Gemini Vision) :**
   * Prompt système pour extraire pair, direction, entry, stop_loss, take_profit, timeframe, pnl, session depuis une image uploadée.
3. **Fiche Détail Trade :** Affichage avant/après des graphiques, ratios R:R, structures ICT/SMC (FVG, Order Block, Liquidity Sweep), données Bookmap.
4. **Générateur de Carte de Partage P&L :** Modale exportable en PNG HD pour réseaux sociaux avec badge métallique, chandeliers et statistiques du trade.

### Module C : Calendrier & Heatmap P&L
* Vue mensuelle sous forme de calendrier interactif.
* Chaque case journalière est colorée en vert néon (gain) ou rouge carmin (perte) avec montant.
* Clic sur un jour pour ouvrir la liste des trades de cette journée.

### Module D : Analytics Avancées
* Heatmap Horaire (Sessions × Jours de la semaine).
* Répartition par Paires & Timeframes (Donut & Bar Charts).
* Corrélation Émotions / Winrate.

### Module E : Playbook & Hard Daily Lock
* Gestion des Setups de trading personnalisés.
* Débriefing journalier avec sélecteur de date natif.
* Overlay Anti-Revenge qui bloque la saisie si la perte journalière maximale est atteinte.

---

## 6. SYSTÈME DE DESIGN & THÈME SOMBRE FINTECH

Le style visuel doit être institutionnel, épuré et ultra-moderne (inspiration Bloomberg Terminal / Linear).

### Palette de Couleurs :
* **Fond Principal :** #060709 (Noir d'encre profond)
* **Fond Cartes & Surfaces :** #0e1017 / #131620
* **Bordures Subtiles :** #1e2230 / gba(255, 255, 255, 0.08)
* **Vert Profit / Néon :** #10B981 / #34D399
* **Rouge Perte :** #EF4444 / #F87171
* **Indigo Primaire :** #6366F1 / #818CF8
* **Or / Attention :** #F59E0B
* **Typographies :**
  * Chiffres & Données Financières : JetBrains Mono
  * Textes & Titres : Plus Jakarta Sans / Inter
* **Logo Officiel :** Badge hexagonal métallique gris titane avec le chiffre 7 stylisé, chandeliers néon vert émeraude et flèche de momentum violet/indigo (**sans cadre carré**).

---

## 7. INTERNATIONALISATION (I18N FR / EN)

L'application Web doit supporter la bascule dynamique instantanée Français ↔ Anglais sans rechargement de page.

---

## 8. GUIDE D'EXÉCUTION PAS-À-PAS POUR L'AGENT IA

1. **Initialisation du projet :**
   \\\ash
   npx create-next-app@latest seven-journal-web --typescript --tailwind --eslint --app --src-dir
   # ou
   npm create vite@latest seven-journal-web -- --template react-ts
   \\\
2. **Installation des dépendances :**
   \\\ash
   npm install @supabase/supabase-js @tanstack/react-query zustand lucide-react lightweight-charts recharts clsx tailwind-merge html-to-image @google/genai
   \\\
3. **Mise en place de la base de données :** Exécuter le script SQL fourni dans la section 3 sur le projet Supabase.
4. **Implémentation des composants et pages :** Suivre les spécifications des modules A à E.
