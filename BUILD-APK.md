# Construire l'APK — pas à pas

Tout se passe **dans le terminal Windows**, à la racine du projet
(`C:\Users\ANDRY\Documents\seven-journal-mobile`).

Le build tourne sur les serveurs d'Expo : rien à installer (pas d'Android
Studio, pas de JDK).

---

## Pourquoi un APK plutôt qu'Expo Go

Trois fonctionnalités reposent sur des modules **natifs**, qu'Expo Go ne peut
pas charger. Elles ne s'activeront qu'ici :

| Fonctionnalité | Module |
|---|---|
| Rappels quotidiens / hebdomadaires | `expo-notifications` |
| Export du visuel de partage en PNG | `react-native-view-shot` |
| Enregistrement dans la galerie | `expo-media-library` |

C'est aussi le seul build qui affiche la vraie icône sur le lanceur.

---

## Étape 1 — Se connecter

```
npx eas login
npx eas whoami
```

Compte Expo gratuit : <https://expo.dev/signup>.

---

## Étape 1 bis — Rattacher le projet à VOTRE compte

`app.json` est arrivé avec un `projectId` hérité du dépôt d'origine, qui
pointait vers le compte Expo de quelqu'un d'autre. Toute commande EAS
répondait alors :

```
You don't have the required permissions to perform this operation.
Entity not authorized: AppEntity[e7d3541d-...]
```

Ce n'était donc **pas** un problème de connexion. Le `projectId` a été retiré ;
la commande suivante en crée un neuf sur votre compte et le réécrit dans
`app.json` :

```
npx eas init
```

Répondez **oui** à la création du projet. À faire une seule fois.

> Le nouveau `projectId` sera commité dans `app.json`. C'est voulu : ce n'est
> pas un secret, juste l'identifiant du projet, et il doit suivre le dépôt.

---

## Étape 2 — Publier les variables d'environnement (À NE PAS SAUTER)

C'est l'étape qui casse silencieusement les premiers builds.

Votre fichier `.env` n'est **pas** versionné (c'est voulu : il contient vos
clés). Le serveur de build ne le voit donc **jamais**. Sans cette étape,
l'APK se construit sans erreur, s'installe, puis reste bloqué à la connexion
— l'URL Supabase est vide à l'intérieur.

Ouvrez votre `.env` et recopiez les deux valeurs :

```
npx eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://VOTRE_REF.supabase.co" --visibility plaintext --environment preview
npx eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "VOTRE_ANON_KEY" --visibility plaintext --environment preview
```

Vérifiez :

```
npx eas env:list --environment preview
```

> `env:create` existait dans les anciennes versions du CLI et affiche
> aujourd'hui « This command is deprecated. Use env:set instead. » — c'est un
> simple avertissement, mais autant utiliser `env:set`.

Les deux variables doivent apparaître.

> `plaintext` est correct ici : ces deux valeurs sont déjà embarquées dans le
> bundle JavaScript livré au téléphone — le préfixe `EXPO_PUBLIC_` signifie
> exactement cela. La clé `anon` est conçue pour être publique ; ce qui
> protège vos données, ce sont les règles RLS de Supabase. Ne mettez
> **jamais** la clé `service_role` ici.

---

## Étape 3 — Lancer le build

```
npx eas build --platform android --profile preview
```

Comptez 10 à 20 minutes. À la première exécution, EAS propose de générer un
**keystore** : répondez oui, il le conserve et le réutilisera.

À la fin, le terminal affiche un lien. Ouvrez-le **sur le téléphone** pour
télécharger le `.apk`.

---

## Étape 4 — Installer

Android demandera d'autoriser l'installation depuis cette source (navigateur
ou gestionnaire de fichiers). C'est normal pour une app hors Play Store.

Si une ancienne version est déjà installée avec une signature différente,
désinstallez-la d'abord.

---

## Étape 5 — Vérifier les notifications

1. Réglages → activer **Notifications**.
2. Android demande l'autorisation → **Autoriser**. En refusant, l'interrupteur
   reste sans effet.
3. Le message « Les rappels seront disponibles dans la prochaine version »
   doit avoir disparu : il ne s'affiche que lorsque le module est absent.

Les rappels sont **locaux** : planifiés par le téléphone, ils fonctionnent
hors ligne et ne nécessitent ni Firebase ni `google-services.json`.

### Sur Xiaomi / MIUI, Samsung, Huawei

Ces surcouches suspendent agressivement les alarmes planifiées. Si les
rappels n'arrivent pas, ce n'est pas l'application :

- Paramètres → Applications → Seven Journal → **Économie de batterie** →
  *Sans restriction*
- Activer **Démarrage automatique**

---

## Mettre à jour plus tard

Relancer la même commande produit un nouvel APK. Le `versionCode` est géré
par EAS (`appVersionSource: remote`), il n'y a rien à incrémenter à la main.

---

## Les profils

| Profil | Sortie | Usage |
|---|---|---|
| `preview` | APK | Ce que vous installez à la main. **C'est celui-ci.** |
| `development` | APK + dev client | Débogage avec rechargement à chaud |
| `production` | AAB | Format exigé par le Play Store, non installable directement |
