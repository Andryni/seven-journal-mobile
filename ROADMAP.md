# Ce qui manque pour un journal réellement professionnel

> Analyse au commit `241bbea`. Chaque point a été vérifié dans le code, pas
> supposé. Classé par ce qui manque *structurellement* d'abord, puis par ce qui
> différencierait l'app.
>
> **Mise à jour du 20/09/2026** : les chantiers livrés depuis cette analyse
> sont barrés, la session y a ajouté sept capacités (voir §5). Restent
> ouverts : le lien débrief ↔ trades (2.2) et trois points de design
> (3.1, 3.2, 3.5).

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

**Livré.** Correction d'un diagnostic erroné de cette ROADMAP au passage : la
limite de perte quotidienne s'appliquait déjà à **tous** les types de compte
(`effective_daily_loss_limit` retombe sur 1 % du solde initial), elle n'était pas
réservée aux comptes challenge. Le vrai manque était ailleurs : l'argent est un
indicateur **retardé** du tilt. Quand la limite de perte saute, le surtrading et
les entrées de revanche ont déjà eu lieu.

Trois règles personnelles ont donc été ajoutées, applicables à n'importe quel
type de compte : `max_trades_per_day`, `max_consecutive_losses` (les deux
verrouillent la session côté serveur, comme la limite de perte) et
`max_risk_per_trade_pct` (bloque la saisie d'un trade surdimensionné avant
l'envoi).

### 2.2 Le débriefing n'est pas relié aux trades du jour

`PlaybookScreen` sait afficher un débriefing, mais ne montre pas les trades de
la journée à côté. On note « j'ai été impatient » sans voir les 4 trades qui le
prouvent.

### 2.3 ~~Pas de recherche ni de filtre avancé~~ — livré

Le filtrage croisé setup × session × état mental × plage de R est en place sur
l'écran des trades ; une recherche simple seule ne permet pas d'investiguer.

### 2.4 ~~Rien pour les captures d'écran en masse~~ — livré

La galerie existe : revoir vingt setups d'affilée, qui est *la* façon
d'entraîner la reconnaissance de patterns.

---

## 3. Design — ce qui reste

1. **Le Dashboard est trop long.** Sept sections en scroll. Un cockpit montre
   trois chiffres en une seconde ; l'écran actuel demande de faire défiler.
   Envisager : un bloc « aujourd'hui » figé en haut, le reste en sections
   repliables.
2. **`LivePanel` n'est utilisé qu'une fois.** La bordure qui porte un état
   mériterait d'être étendue : positions ouvertes, risque quotidien, règle prop
   firm proche de la limite.
3. ~~**Accessibilité**~~ — traité : 86 labels, et surtout `accessibilityRole`
   + `accessibilityState={selected}` sur les bascules, qui est ce qui manquait
   réellement (un label seul ne dit pas quelle option est active).
4. **Pas de retour visuel de chargement par section.** Un spinner plein écran
   masque tout ; des squelettes par panneau donneraient une impression de
   vitesse très supérieure. (Analytics a déjà les siens ; le reste de l'app
   attend encore.)
5. **Le mode clair n'est probablement pas testé.** 94 `rgba()` codés en dur
   subsistent dans les composants.

---

## 4. Ce que je ferais, dans l'ordre

| # | Chantier | Pourquoi maintenant |
|---|---|---|
| ~~1~~ ✅ | ~~**Frais (commission/swap)**~~ — livré (`6a1b6bd`) | Fausse toutes les statistiques d'un trader actif. Plus on attend, plus il y a de trades à recalculer. |
| ~~2~~ ✅ | ~~**MAE / MFE**~~ — livré | Deux champs, et le Playbook gagne les seules analyses qui font progresser. |
| ~~3~~ ✅ | ~~**Objectifs personnels + Lock Guard pour tous**~~ — livré | Étend votre meilleur différenciateur aux comptes non-prop. |
| ~~4~~ ✅ | ~~**Tags libres + filtrage croisé**~~ — livré | Rend le journal interrogeable. |
| ~~5~~ ✅ | ~~**Sorties partielles**~~ — livré | Le plus lourd ; à faire une fois les trois premiers en place. |
| ~~6~~ ✅ | ~~**Push serveur**~~ — livré | Un garde-fou que personne n'entend n'est pas un garde-fou. |
| ~~7~~ ✅ | ~~**Replay bougies via le terminal**~~ — livré (EA v1.17) | Le différenciateur : aucun concurrent mobile n'a de terminal à interroger. |
| ~~8~~ ✅ | ~~**Contexte de news écrit sur le trade**~~ — livré | Espérance conditionnelle aux news + règle de fenêtre traçable. |
| ~~9~~ ✅ | ~~**Pré-vol verrouillant**~~ — livré | L'argent est un indicateur retardé ; la checklist agit avant l'entrée. |
| ~~10~~ ✅ | ~~**Coût de l'indiscipline cumulé**~~ — livré | L'idée d'AUDIT-2, rendue possible par les tags ; buckets exclusifs, zéro double compte. |
| ~~11~~ ✅ | ~~**EA embarqué + OTA**~~ — livré | Corriger un terminal trop ancien sans passer par le PC. |

## 5. Livré depuis l'analyse (session du 20/09/2026)

Tout est en code, sous 1 193 tests, `tsc` et ESLint propres :

1. **Alertes serveur (push).** Terminal muet, verrou déclenché : table de
   jetons, Edge Function `push`, balayages `pg_cron` planifiés, inscription
   depuis l'app avec interrupteur et désinscription à la déconnexion.
2. **Replay de bougies.** L'app demande la fenêtre M1 d'un trade, le terminal
   répond (EA v1.17), le détail affiche la bougie avec entrée, SL, TP, sortie
   et MAE/MFE. Mise en cache par trade : une demande satisfaite ne repart
   jamais vers le terminal.
3. **Contexte de news écrit sur le trade**, avec garde de fenêtre à la saisie.
4. **Pré-vol verrouillant.** La checklist du jour se coche avant
   d'enregistrer ; l'oubli est daté, donc traçable.
5. **Coût de l'indiscipline cumulé** — l'idée d'`AUDIT-2.md` : buckets
   exclusifs (tilt, hors plan, revanche) comparés aux trades propres du
   trader, en devise, sans jamais compter un trade deux fois.
6. **OTA + EA embarqué.** Mise à jour à la volée proposée au lancement ; le
   fichier de l'EA se partage depuis la feuille du connecteur.
7. **Gestion des connecteurs** : renommer, régénérer le secret, mettre en
   pause — sans supprimer ; et la version de l'EA est affichée, avec un
   avertissement explicite quand le terminal est trop ancien pour répondre
   aux demandes de complétion ou de bougies.

Le « trade jumeau » d'`AUDIT-2.md` est également livré. Restent les points
non barrés du §2.2 et du §3.
