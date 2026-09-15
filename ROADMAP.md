# Ce qui manque pour un journal réellement professionnel

> Analyse au commit `241bbea`. Chaque point a été vérifié dans le code, pas
> supposé. Classé par ce qui manque *structurellement* d'abord, puis par ce qui
> différencierait l'app.

---

## 1. Les trous dans le modèle de données

Ce sont les manques les plus sérieux : aucune quantité d'UI ne les compense, et
plus il y a de trades en base, plus ils coûtent cher à combler.

### 1.1 Aucun champ pour les frais — commission, spread, swap

`Trade` n'a qu'un `pnl` unique. Rien ne dit s'il est **brut ou net**.

Conséquences concrètes :

- Un scalpeur qui prend 20 trades par jour paie en commissions l'équivalent de
  plusieurs R par semaine. Son expectancy affichée est **structurellement
  fausse**, et l'app le confortera dans une stratégie qui perd de l'argent.
- Les positions gardées plusieurs jours subissent un swap. La durée de
  détention est désormais affichée, mais son coût reste invisible.
- Un import MT4/MT5 contient les colonnes commission et swap : **l'app les
  jette aujourd'hui**.

C'est, à mon avis, le manque n°1. Un journal qui ne distingue pas brut et net
n'est pas un outil de mesure fiable pour un trader actif.

**Proposition** : `commission`, `swap` et `pnl_gross` en base, `pnl` restant le
net (donc aucune rupture pour les données existantes), et un rappel « net de
frais » sur les écrans de synthèse.

### 1.2 Pas de sorties partielles

Sortir en plusieurs fois est une pratique standard. Le modèle impose un
`exit_price` unique, donc le trader doit saisir un prix moyen inventé — et
c'est précisément ce qui a produit le bug que vous venez de signaler : un BE
à +0,5R *est* une sortie partielle mal représentée.

**Proposition** : une table `trade_exits` (prix, quantité, date). Plus lourd,
mais c'est la seule façon honnête de représenter un scale-out.

### 1.3 Pas de MAE / MFE

MAE (pire excursion adverse) et MFE (meilleure excursion favorable) sont les
deux statistiques que les journaux sérieux exploitent, et elles répondent à des
questions que votre app ne peut pas encore poser :

- « Mes stops sont-ils trop serrés ? » → MAE des trades gagnants.
- « Est-ce que je sors trop tôt ? » → écart entre MFE et le gain réalisé.

Deux champs numériques suffisent, et le Playbook saurait immédiatement quoi en
faire.

### 1.4 Pas de tags libres sur les trades

Les setups du Playbook sont structurés, mais il n'existe aucun moyen de marquer
« news CPI », « fin de session », « après 3 pertes ». Les notes en texte libre
ne sont pas analysables — c'est d'ailleurs pour ça que l'ancien matcher du
Playbook fouillait dedans avec `includes()`.

---

## 2. Features manquantes qui se voient à l'usage

### 2.1 Aucun objectif ni règle personnelle

L'app suit les règles **prop firm** (daily loss, drawdown), mais un trader
personnel n'a rien : pas de « max 3 trades/jour », pas de « risque max 1% », pas
d'objectif mensuel. Le Lock Guard est votre meilleure idée et il ne sert
aujourd'hui qu'aux comptes challenge.

### 2.2 Le débriefing n'est pas relié aux trades du jour

`PlaybookScreen` sait afficher un débriefing, mais ne montre pas les trades de
la journée à côté. On note « j'ai été impatient » sans voir les 4 trades qui le
prouvent.

### 2.3 Pas de recherche ni de filtre avancé

`TradesScreen` a une recherche simple. Il manque le filtrage croisé (setup ×
session × état mental × plage de R) qui transforme un journal en outil
d'investigation.

### 2.4 Rien pour les captures d'écran en masse

Les champs `screenshot_before_url` / `after_url` existent, mais il n'y a pas de
galerie : impossible de revoir 20 setups d'affilée, ce qui est pourtant *la*
façon dont on entraîne sa reconnaissance de patterns.

---

## 3. Design — ce qui reste

1. **Le Dashboard est trop long.** Sept sections en scroll. Un cockpit montre
   trois chiffres en une seconde ; l'écran actuel demande de faire défiler.
   Envisager : un bloc « aujourd'hui » figé en haut, le reste en sections
   repliables.
2. **`LivePanel` n'est utilisé qu'une fois.** La bordure qui porte un état
   mériterait d'être étendue : positions ouvertes, risque quotidien, règle prop
   firm proche de la limite.
3. **Accessibilité** : 104 `TouchableOpacity` pour 53 `accessibilityLabel`.
4. **Pas de retour visuel de chargement par section.** Un spinner plein écran
   masque tout ; des squelettes par panneau donneraient une impression de
   vitesse très supérieure.
5. **Le mode clair n'est probablement pas testé.** 94 `rgba()` codés en dur
   subsistent dans les composants.

---

## 4. Ce que je ferais, dans l'ordre

| # | Chantier | Pourquoi maintenant |
|---|---|---|
| 1 | **Frais (commission/swap)** | Fausse toutes les statistiques d'un trader actif. Plus on attend, plus il y a de trades à recalculer. |
| 2 | **MAE / MFE** | Deux champs, et le Playbook gagne les seules analyses qui font progresser. |
| 3 | **Objectifs personnels + Lock Guard pour tous** | Étend votre meilleur différenciateur aux comptes non-prop. |
| 4 | **Tags libres + filtrage croisé** | Rend le journal interrogeable. |
| 5 | **Sorties partielles** | Le plus lourd ; à faire une fois les trois premiers en place. |

Les idées « coût de l'indiscipline » et « trade jumeau » de `AUDIT-2.md` restent
valables et deviennent nettement plus fortes une fois les tags (4) en place.
