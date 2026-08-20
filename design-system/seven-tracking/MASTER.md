# SEVEN JOURNAL — Design System Master

> Source de vérité du design system. Single source of truth: `src/theme/index.ts`.
> Ce document décrit le système **réellement implémenté** dans le code (Expo / React Native 0.86).

---

## 1. Profil Produit

| Champ | Valeur |
|-------|--------|
| Produit | Terminal de trading quantitatif (journal P&L, analytics, prop firm tracker) |
| Catégorie (ui-ux-pro-max) | **Financial Dashboard** — portfolio, trading, pnl, balance-sheet, fintech |
| Direction visuelle | **Dark Mode (OLED) + Data-Dense Dashboard**, Minimalisme & Swiss Style |
| Mots-clés | Contraste élevé, mises à jour temps réel, précision primordiale |
| Plateformes | React Native (Expo SDK 57), iOS + Android |

**Positionnement coloré** : fond sombre + alertes **rouge/vert** + bleu de confiance (indigo).
La palette suit le profil "Financial Dashboard" : l'indigo est la couleur de marque/interaction, l'or est réservé aux objectifs prop firm.

---

## 2. Principes de Design

1. **Les données d'abord** — les chiffres utilisent une police mono tabulaire (`tabular-nums`), jamais de graisse fantaisiste.
2. **Couleur = sens** — vert = gain, rouge = perte, or = target prop firm. La couleur ne porte jamais l'information seule (doublée par un symbole +/−).
3. **Esthétique terminal** — fonds très sombres (#07080a) en mode dark, clairs (#f1f2f7) en mode light, bordures subtiles en alpha, ombres profondes.
4. **Densité maîtrisée** — compact mais lisible : minimum **9px** pour les labels essentiels, **10px** pour le corps de texte.
5. **Accessibilité native** — tout bouton icône a un `accessibilityLabel`, cibles tactiles ≥ 44px via `hitSlop`, focus/état visibles.
6. **Thème dynamique** — dark et light via `useTheme()` (store zustand persisté) ; aucun style figé au module scope.
7. **i18n FR/EN** — toutes les chaînes visibles passent par `useT()` (dictionnaires `src/i18n/translations.ts`), jamais en dur.

---

## 3. Système de Couleurs

> **Deux thèmes complets** : `darkTheme` et `lightTheme` dans `src/theme/index.ts`.
> Le mode actif est stocké dans `useThemeStore` (persisté AsyncStorage, clé `seven-theme-mode`).
> Chaque composant appelle `useTheme()` et recrée ses styles via `createStyles(theme)` en `useMemo`.
> **Règle absolue** : les styles doivent être déclarés `const createStyles = (theme: AppTheme) => StyleSheet.create({...})` — jamais `const styles = StyleSheet.create({...})` au module scope (figé au chargement).

### 3.1 Tokens sémantiques — valeurs DARK (couche appliquée en mode sombre)

| Token | Valeur | Usage |
|-------|--------|-------|
| `colors.background` | `#07080a` | Fond racine de l'app (screens, containers) |
| `colors.backgroundElevated` | `#0d0f15` | Cartes élevées, modales, checklist |
| `colors.inputBg` | `#0a0c12` | Champs de saisie, fonds encastrés |
| `colors.modalBg` | `#181920` | Fond des modales plein écran |
| `colors.chartBg` | `#12141c` | Fond des charts (SVG) |
| `colors.card` | `#12141c` | Cartes standard, KpiCard |
| `colors.surface` | `#161922` | Sous-surfaces, pickers, sections |
| `colors.surfaceLight` | `#1f2330` | Surfaces claires (hover/élevées) |
| `colors.cardBorder` | `rgba(255,255,255,0.08)` | Bordure standard des cartes |
| `colors.borderStrong` | `#262833` | Bordures fortes (modales, inputs) |
| `colors.borderBright` | `rgba(255,255,255,0.15)` | Bordures de focus / mises en avant |
| `colors.primary` | `#6366f1` | Actions, boutons, tabs actifs, lien |
| `colors.primaryLight` | `#818cf8` | Icônes actives, labels "live", accent |
| `colors.primaryDeep` | `#4f46e5` | Gradient (bouton "NOUVEAU") |
| `colors.primaryGlow` | `rgba(99,102,241,0.25)` | Halo lumineux indigo |
| `colors.gold` | `#f59e0b` | Objectifs prop, streaks |
| `colors.goldLight` | `#fbbf24` | Textes or clairs |
| `colors.green` | `#10b981` | Gains, win, positif |
| `colors.greenLight` | `#34d399` | Textes gains clairs |
| `colors.red` | `#ef4444` | Pertes, suppression, danger |
| `colors.redLight` | `#f87171` | Textes pertes clairs |
| `colors.cyan` | `#06b6d4` | Métriques info (ratio gain/perte, cumul R) |
| `colors.cyanLight` | `#67e8f9` | Textes cyan clairs |
| `colors.textPrimary` | `#ffffff` | Texte principal (remplace tous les `#ffffff` en dur) |
| `colors.textSecondary` | `#94a3b8` | Texte secondaire, labels de KPI |
| `colors.textMuted` | `#64748b` | Texte atténué, dates, timestamps |
| `colors.textDark` | `#475569` | Texte presque invisible (placeholders, fonds) |

### 3.2 Couche primitive (valeurs brutes sous-jacentes)

| Famille | Primitives |
|---------|-----------|
| Indigo (marque) | `#4f46e5` → `#6366f1` → `#818cf8` |
| Émeraude (gain) | `#10b981` → `#34d399` |
| Pourpre (perte) | `#ef4444` → `#f87171` |
| Or (prop) | `#f59e0b` → `#fbbf24` |
| Cyan (info) | `#06b6d4` → `#67e8f9` |
| Gris ardoise (texte) | `#475569` → `#64748b` → `#94a3b8` → `#ffffff` |
| Sombre (fonds) | `#07080a` → `#0a0c12` → `#0d0f15` → `#12141c` → `#161922` → `#181920` |

### 3.3 Sémantique d'usage (ne jamais détourner)

- **vert/rouge** : uniquement P&L, win/loss, gains/pertes.
- **or** : uniquement prop firm (target, challenge, streak, rule).
- **indigo** : interactions (boutons, tabs actifs, liens, "live").
- **cyan** : métriques d'information neutre.
- **noir `#000000`** : uniquement ombres et placeholder d'image — jamais de texte.

### 3.4 Règles

- **Aucun hex en dur dans les composants** — toujours `theme.colors.*` (validé par `validate-tokens`).
- Les variantes alpha (`rgba(...)`) sont tolérées uniquement pour les overlays de modale (`rgba(0,0,0,0.85)`) et les ombres (`#000000`) ; les halos et bordures alpha sont des tokens (`*Glow`, `cardBorder`).
- Contraste texte/fond ≥ 4.5:1 (textSecondary sur card : OK, textMuted sur card : réservé aux éléments secondaires).
- **Pas de `rgba(255,255,255,...)` en dur** : remplacer par `cardBorder` / `borderBright` / `surface` (définis différemment selon le mode).

---

## 4. Typographie

### 4.1 Polices chargées (App.tsx → `useFonts`)

| Famille | Weights | Rôle |
|---------|---------|------|
| **JetBrains Mono** | 400 / 500 / 700 / 800 | Données, chiffres, labels techniques, timestamps |
| **Plus Jakarta Sans** | 400 / 500 / 600 / 700 / 800 | Titres, corps de texte, UI |

### 4.2 Rôles typographiques

| Rôle | Token | Exemples |
|------|-------|----------|
| Titre d'écran | `sansExtraBold` | "ANALYTICS & PROP FIRM", "JOURNAL DES POSITIONS" |
| Titre de carte | `sansExtraBold` (Card `titleText`) | "KPI GLOBAUX", "COURBE D'ÉQUITÉ" |
| Titre de section (modales) | `monoBold` | "PARAMÈTRES D'EXÉCUTION", "PSYCHOLOGIE & NOTES" |
| Valeurs KPI / chiffres majeurs | `monoExtraBold` | Net P&L, solde, P&L du mois |
| PnL / prix / R-multiple | `monoBold` | `+$500.00`, `-1.5R`, dates |
| Petits labels (KPI, stats, champs) | `monoBold` | "NET P&L TOTAL", "WIN RATE", "SOLDE ACTUEL" |
| Sous-labels / timestamps | `monoMedium` | dates de trade, sessions |
| Corps / descriptions | `sans` / `sansMedium` | notes, sous-titres, empty states |
| Boutons UI | `sansBold` (actions) / `monoBold` (actions terminal) | "SAUVEGARDER", "SUPPRIMER" |
| Texte actif de tab | `monoBold` blanc | "VUE D'ENSEMBLE", "TRADES" |

### 4.3 Règles

- **Tous les chiffres financiers** : `fontVariant: ['tabular-nums']` obligatoire (alignement vertical).
- **Minimum 9px** pour les labels essentiels (kpiLabel, statLabel) — jamais en dessous.
- **Corps de texte ≥ 10px** ; pas de texte important sous 9px.
- Pas plus de **2 familles par vue** (mono pour données + sans pour UI).
- Ne jamais écrire de poids : utiliser la graisse chargée (`monoBold`, pas `fontWeight: '700'` + fontFamily système).

---

## 5. Espacements & Rayons

### 5.1 Échelle d'espacement (base 4px)

| Token | Valeur | Usage typique |
|-------|--------|---------------|
| `spacing.xs` | 4 | Gaps serrés (icônes, pills) |
| `spacing.sm` | 8 | Entre éléments interactifs (min tactile) |
| `spacing.md` | 12 | Padding standard de card/section |
| `spacing.lg` | 16 | Padding de screens, hero |
| `spacing.xl` | 20 | Padding de modales / auth |
| `spacing.xxl` | 28 | Séparations majeures |

### 5.2 Rayons

| Token | Valeur | Usage |
|-------|--------|-------|
| `borderRadius.xs` | 4 | Badges, petites pills |
| `borderRadius.sm` | 8 | Chips, inputs compacts |
| `borderRadius.md` | 12 | Boutons, KpiCard, inputs |
| `borderRadius.lg` | 18 | Cartes, modales, blocs |
| `borderRadius.xl` | 24 | Modales principales |
| `borderRadius.full` | 9999 | Pills, dots |

---

## 6. Composants

> **Inventaire exhaustif** — ce tableau est la liste complète des composants vivants. Tout composant non référencé ici ou non importé est du code mort : **il doit être supprimé**, pas conservé (ex. `ui/Button.tsx` était un composant jamais importé — supprimé).

| Composant | Fichier | Usage |
|-----------|---------|-------|
| `Card` | `src/components/ui/Card.tsx` | Conteneur de section avec titre + badge + `headerAction` |
| `Badge` | `src/components/ui/Badge.tsx` | Tags de statut (green/red/gold/blue/cyan/neutral, sm/md, pulse) |
| `KpiCard` | `src/components/ui/KpiCard.tsx` | Carte KPI (label + valeur + sub), variantes `card`/`surface` |
| `StatRow` | `src/components/ui/StatRow.tsx` | Ligne label/valeur (détails métriques, paramètres) |
| `SectionTabs` | `src/components/ui/SectionTabs.tsx` | Tabs horizontales avec icônes actives, option `scrollable` |
| `PickerModal` | `src/components/ui/PickerModal.tsx` | Sélecteur générique (compte, session) avec `accessibilityState` |
| `BicolorBarChart` | `src/components/ui/BicolorBarChart.tsx` | Barres P&L bicolores (vert/rouge) avec tooltip |
| `GlowingEquityAreaChart` | `src/components/ui/GlowingEquityAreaChart.tsx` | Courbe d'équité lumineuse avec tooltip |
| `ChecklistCard` | `src/components/dashboard/ChecklistCard.tsx` | Checklist pré-session (supabase) |
| `TopAccountBar` | `src/components/common/TopAccountBar.tsx` | Barre compte actif + sélecteur + logout |
| `LiveTickerBanner` | `src/components/common/LiveTickerBanner.tsx` | Ticker animé des derniers trades |
| `AnimatedSplashScreen` | `src/components/common/AnimatedSplashScreen.tsx` | Splash animée au lancement (App.tsx) |
| `ShareCardModal` | `src/components/share/ShareCardModal.tsx` | Modale d'export/partage de carte P&L |
| `TradeFormModal` | `src/components/trades/TradeFormModal.tsx` | Modale création/édition de trade (composant le plus gros, à surveiller) |
| `TradeDetailModal` | `src/components/trades/TradeDetailModal.tsx` | Modale de détail d'un trade (modifier/supprimer) |

### 6.1 États — Card

| Propriété | Normal | Glow |
|-----------|--------|------|
| Background | `card` (gradient card→backgroundElevated) | idem |
| Border | `cardBorder` | `cardBorderGlow` |
| Shadow | 0,6,12 noir 0.4 | 0,6,16 indigo 0.25 |
| Top highlight | gradient blanc→indigo→transparent | idem |

### 6.2 États — Badge

| Variante | Fond | Bordure | Texte |
|----------|------|---------|-------|
| green | `rgba(16,185,129,0.12)` | `rgba(16,185,129,0.35)` | `greenLight` |
| red | `rgba(239,68,68,0.12)` | `rgba(239,68,68,0.35)` | `redLight` |
| gold | `rgba(245,158,11,0.12)` | `rgba(245,158,11,0.35)` | `goldLight` |
| blue | `rgba(99,102,241,0.12)` | `rgba(99,102,241,0.35)` | `primaryLight` |
| cyan | `rgba(6,182,212,0.12)` | `rgba(6,182,212,0.35)` | `cyanLight` |
| neutral | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.1)` | `textSecondary` |

### 6.3 États — SectionTabs

| État | Fond | Bordure | Texte |
|------|------|---------|-------|
| Inactif | `card` | `cardBorder` | `textMuted` |
| Actif | `rgba(99,102,241,0.2)` | `primary` | `textPrimary` |

### 6.4 États — PickerModal

| État | Fond | Bordure | Check |
|------|------|---------|-------|
| Inactif | `surface` | `rgba(255,255,255,0.04)` | — |
| Actif | `rgba(99,102,241,0.2)` | `primary` | `green` ✓ + `accessibilityState.selected` |

---

## 7. Graphiques (charts)

| Type de donnée | Chart utilisé | Recommandation ui-ux-pro-max |
|----------------|---------------|-------------------------------|
| P&L quotidien / mensuel | `BicolorBarChart` | Bar chart bicolore (vert/rouge) — pas de couleur seule |
| Courbe d'équité | `GlowingEquityAreaChart` | **Streaming Area Chart** ✓ |
| Target prop firm | `ProgressChart` + barre de progression | **Bullet/Gauge Chart** ✓ |
| Répartition gains/pertes | `PieChart` | Pie avec légende (accessible) |
| Long vs Short | barres de ratio | Ratio bar |

**Règles** : tooltip toujours présent, couleur + valeur dans le tooltip (jamais couleur seule), axes en `monoBold`.

---

## 8. Icônes & Navigation

- **Uniquement `lucide-react-native`** — jamais d'émoji en guise d'icône.
- **Bottom nav ≤ 6 onglets** (actuel : 6 — Dashboard, Trades, Calendar, Analytics, Playbook, Accounts).
- **Boutons icône uniquement** : `accessibilityLabel` obligatoire + `hitSlop` ≥ 8px (fermer, modifier, supprimer, logout, navigation calendrier).
- Icônes décoratives : `accessibilityElementsHidden` / pas de label.

---

## 8bis. Internationalisation (FR/EN)

- **Dictionnaires** : `src/i18n/translations.ts` — objets `fr` et `en` avec les **mêmes clés**.
- **Hook** : `useT()` → `{ t, lang, toggleLang }` (store zustand persisté, clé `seven-language`).
- **Règles** :
  - Toute chaîne visible (titre, bouton, label, placeholder, empty state) passe par `t('key')`.
  - Les fonctions de clé (`t('accountsCount', n)`) sont autorisées pour les plurielles.
  - Ne jamais concaténer de libellé en dur dans le JSX.
  - Le toggle langue est dans `TopAccountBar` (icône `Languages` + code).

---

## 9. Anti-patterns à éviter (Do / Don't)

---

## 9. Anti-patterns à éviter (Do / Don't)

| ❌ Don't | ✅ Do |
|---------|------|
| Hex en dur (`#10b981`, `#ffffff`) dans les composants | `theme.colors.*` uniquement |
| `fontWeight` + police système | `theme.fonts.monoBold` / `sansBold`… |
| Chiffres sans `tabular-nums` | `fontVariant: ['tabular-nums']` |
| Labels < 9px | Minimum 9px (essentiel) / 10px (corps) |
| Émoji comme icônes | `lucide-react-native` |
| Vert/rouge pour autre chose que P&L | Réserver au sens gain/perte |
| Boutons icône sans `accessibilityLabel` | Toujours label + `hitSlop` |
| Truncation du texte essentiel (dates, PnL) | `numberOfLines` + `adjustsFontSizeToFit` |
| Texte clippé par `overflow: hidden` | Laisser respirer les labels d'axes |

---

## 10. Checklist pré-livraison

- [ ] Zéro hex en dur hors `src/theme/index.ts` (grep `#[0-9a-fA-F]{6}`)
- [ ] `tsc --noEmit --noUnusedLocals --noUnusedParameters` sans erreur
- [ ] Contraste ≥ 4.5:1 pour le texte essentiel (vérifié dans les deux modes dark/light)
- [ ] Tous les boutons icône ont un `accessibilityLabel`
- [ ] Aucun label essentiel sous 9px
- [ ] Chiffres financiers en `mono` + `tabular-nums`
- [ ] Les badges/chips reflow sans clipping (test à 375px)
- [ ] Pas d'émoji en guise d'icône
- [ ] Les montants : `+$500.00` / `-$500.00` via `formatCurrency` (signe devant le $)
- [ ] Aucun composant mort : chaque fichier de `src/components/` est importé (grep du nom de fichier) et listé en section 6
- [ ] Styles déclarés `createStyles(theme)` — aucun `const styles = StyleSheet.create` au module scope
- [ ] Aucun `rgba(255,255,255,...)` en dur (grep) — utiliser `cardBorder`/`borderBright`/`surface`
- [ ] Toggle thème (TopAccountBar) teste les deux modes sans régression
- [ ] Chaînes visibles via `useT()` — aucun libellé FR en dur dans le JSX (à terme)

---

## 11. Récupération par page (pattern Master + Overrides)

Si une page a des déviations spécifiques, créer `design-system/seven-tracking/pages/<page>.md`.
Les règles de la page priment sur le Master. Pages candidates : `dashboard`, `analytics`, `trades`, `calendar`, `playbook`, `accounts`.
