# Audit Seven Journal — état après les 10 correctifs

> Base : commit `dadab04`. 26 526 lignes TS/TSX, 345 tests, 18 suites.
> Cet audit ne répète pas `AUDIT.md` : il constate ce qui a été réglé depuis et
> ne liste que ce qui reste vrai **aujourd'hui**, vérifié dans le code.

---

## 1. Ce qui est désormais solide

| Point | Vérification |
|---|---|
| Palette de marque | Plus aucun `#6366f1` / `#10b981` / `#ef4444` dans `src/theme`. L'identité Tailwind-par-défaut a disparu. |
| Emoji comme icônes | 0 occurrence. DESIGN.md est enfin respecté. |
| Faux « ticker live » | Composant supprimé. La promesse trompeuse n'est plus affichée. |
| Dette déclarée | 0 `TODO` / `FIXME` / `HACK`, 0 `console.log`, 2 `@ts-ignore` seulement. |
| Secrets | Aucune clé en dur ; `.env` non suivi, seul `.env.example` est versionné. |
| Robustesse | `ErrorBoundary` monté dans `App.tsx`. |
| Listes | `TradesScreen` virtualise via `FlatList` — pas de `.map()` sur tout le journal. |
| Multi-devises | `hasMixedCurrencies` empêche d'additionner EUR et USD. Testé. |
| Noyau de calcul | 345 tests sur le sizing, l'import, l'attribution des setups, les échelles de charts. |

---

## 2. Bugs réels trouvés pendant cet audit

### 2.1 Le Dashboard compte les breakeven comme des pertes — CRITIQUE

`src/features/dashboard/usePerformanceMetrics.ts:47`

```ts
const lossTrades = closedTrades.filter((t) => (t.pnl || 0) <= 0);  // <= inclut BE
```

Alors que `useAnalytics.ts:90` fait, correctement :

```ts
const losses = closed.filter(t => (t.pnl || 0) < 0);
```

Conséquences, toutes visibles à l'écran :

- Le Dashboard affiche `12W / 8L` là où l'Analytics affiche `12W / 6L / 2BE`.
  **Deux écrans de la même app donnent deux chiffres différents.**
- `avgLoss` est dilué : les BE (P&L = 0) entrent au dénominateur, donc la perte
  moyenne affichée est **plus basse que la réalité**. Un trader qui dimensionne
  son risque sur ce chiffre sous-estime ses pertes.
- Le `profitFactor` reste juste (un BE ajoute 0 au gross loss), ce qui rend
  l'incohérence d'autant plus difficile à repérer.

### 2.2 Profit factor infini maquillé en `99.99`

`usePerformanceMetrics.ts:53`

```ts
const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;
```

`99.99` est une valeur inventée qui **se présente comme une mesure**. Un
débutant avec 3 gains et 0 perte lit « PF 99.99 » et croit tenir une stratégie
exceptionnelle. Le module `setupAttribution.ts` que je viens d'écrire traite
déjà ce cas honnêtement (retour `0`, rendu `—`) : les deux moteurs divergent.

### 2.3 `usePerformanceMetrics` n'a aucun test

C'est le moteur des KPI du Dashboard — l'écran d'ouverture — et le seul module
de calcul non couvert. Les deux bugs ci-dessus sont précisément ce qu'un test
aurait arrêté. Les 14 modules sans test sont sinon des hooks d'I/O ; celui-ci
est du calcul pur, donc trivial à couvrir.

---

## 3. La feature fantôme qui reste : l'écriture hors ligne

`PRODUCT.md` promet, deux fois :

> « L'app doit fonctionner **offline** avec sync différée quand le réseau revient »

Et `src/api/queryClient.ts` le commente comme fait :

> « mutations are given a resume-capable default so they can be replayed »

**C'est faux, et il manque exactement deux pièces :**

| Pièce | État | Sans elle |
|---|---|---|
| `persistQueryClient` | ✅ présent | — |
| `onlineManager.setEventListener(NetInfo)` | ❌ **absent** | React Query se croit toujours en ligne : il n'a aucune raison de mettre une mutation en pause. |
| `queryClient.setMutationDefaults` | ❌ **absent** | Même en pause, une mutation n'a pas de `mutationFn` après un redémarrage : elle est **perdue définitivement**. |

Le comportement réel aujourd'hui : hors ligne, la **lecture** fonctionne (cache
persisté, bon point), mais enregistrer un trade déclenche 3 retries, puis
`onError` → toast rouge → **le trade est perdu**. `OfflineBanner` prévient que
l'on est hors ligne, mais n'empêche pas la saisie.

C'est le scénario nominal d'un trader : on journalise juste après la séance,
souvent en déplacement, en métro, en zone blanche. La promesse est au cœur du
produit et c'est la seule non tenue.

---

## 4. Améliorations produit — par rapport valeur / effort

### Priorité 1 — crédibilité des chiffres (l'app est un instrument de mesure)

1. **Corriger le comptage BE + le `99.99`**, et créer un module de stats unique
   partagé par le Dashboard et l'Analytics. Aujourd'hui deux implémentations
   parallèles dérivent l'une de l'autre ; elles divergeront encore.
2. **Tester `usePerformanceMetrics`** (~1 h, calcul pur).

### Priorité 2 — tenir la promesse offline

3. Brancher `onlineManager` sur NetInfo + `setMutationDefaults` pour les 3
   mutations de trade. ~80 lignes. Transforme une promesse trompeuse en vrai
   différenciateur, et c'est ce qu'aucun concurrent mobile ne fait bien.
4. Afficher une **file d'attente visible** (« 2 trades en attente de sync »).
   La confiance vient de voir que rien n'est perdu.

### Priorité 3 — ce qui rendrait l'app vraiment unique

Le positionnement revendiqué est « cockpit », pas « joli journal ». Trois idées
qui exploitent des données **déjà présentes en base** et qu'aucun concurrent
(Edgewonk, TraderSync, Myfxbook) ne combine sur mobile :

5. **Le coût de l'indiscipline, chiffré.** Vous avez `mental_state`, les
   `mistakes_committed` du débriefing, et désormais l'adhérence au playbook.
   Une seule phrase par semaine : *« Le revenge trading vous a coûté 840 € sur
   30 jours »*. C'est le genre de chiffre qui change un comportement — et vous
   avez déjà toute la donnée pour le calculer.
6. **Le trade « jumeau ».** À la saisie, retrouver les N trades passés les plus
   proches (même paire, même setup, même session, même état mental) et afficher
   leur résultat agrégé *avant* la validation : *« Vos 7 derniers XAUUSD en
   revenge le vendredi : -4,2R »*. Le journal cesse d'être rétrospectif et
   devient un garde-fou au moment de la décision. C'est la suite naturelle du
   Lock Guard, qui est déjà votre meilleure idée.
7. **Un vrai écran hebdomadaire.** `weeklyReview.ts` existe et est testé, mais
   reste peu exposé. Un rituel du dimanche — 5 chiffres, 1 graphique, 1 action
   pour la semaine — crée la rétention que 30 KPI sur un dashboard ne créent
   pas.

### Priorité 4 — design

8. **Densifier plutôt qu'ajouter.** Le diagnostic d'`AUDIT.md` (« tout est une
   carte arrondie ») reste partiellement vrai. Un terminal, ce sont des zones
   séparées par des filets fins et des tableaux denses ; la distinction
   `Panel` / `Card` existe déjà dans le code, il faut l'exploiter plus
   franchement au lieu d'empiler des cartes.
9. **Accessibilité** : 104 `TouchableOpacity` pour 53 `accessibilityLabel`.
   La moitié des contrôles sont muets pour un lecteur d'écran.
10. **Découper les écrans monolithiques** : `TradeFormModal` (1 679 l.),
    `PlaybookScreen` (1 604 l.), `AnalyticsScreen` (1 442 l.). Non urgent pour
    l'utilisateur, mais chaque nouvelle feature y coûte de plus en plus cher.

---

## 5. Ce que je ne recommande pas

- **Passer à Victory Native XL / Skia.** Cela imposerait une dev build et
  casserait le workflow Expo Go documenté dans le README, pour des types de
  graphiques déjà couverts par le SVG maison.
- **Ajouter des features au Dashboard.** Il est déjà à la limite de la
  surcharge. Les idées 5-7 méritent leurs propres surfaces.
