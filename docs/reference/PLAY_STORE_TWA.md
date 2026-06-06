# Trail Cockpit → Play Store via TWA (étude)

> Étude du wrapper natif **TWA (Trusted Web Activity)** pour Trail Cockpit (PWA Next.js, https://trailcockpit.run).
> Objectif initial : **maîtriser complètement le splash de lancement** (le splash « OS » d'une PWA installée n'est pas contrôlable). Bénéfice annexe : présence **Play Store**.
> Source de vérité au 2026-06-06. Outillage : Bubblewrap (GoogleChromeLabs).

## 1. Ce que résout un TWA

Un TWA = une app Android minimale qui ouvre **notre PWA en plein écran** (Chrome sous le capot, sans barre d'URL). Le contenu reste **100 % notre site live** : tout déploiement web s'applique immédiatement, sans republier l'app.

Ce qu'on **gagne** vs PWA installée :
- **Splash natif entièrement contrôlé** : image + couleur de fond + durée de fondu, affiché **instantanément** par Android pendant que la WebView charge la PWA, puis fondu. → fini le « icône nue 2-3 s » qu'on ne pouvait pas piloter.
- Présence **Play Store** (découverte, install « normale », mises à jour gérées).
- Icône adaptive Android propre, nom, notifications natives possibles.

Ce qu'on **ne change pas** : le code web. Le TWA ne fait qu'emballer.

## 2. Le splash TWA (le point clé)

C'est LE gain recherché. Deux niveaux :

- **Par défaut (Bubblewrap)** : splash = **icône 512 centrée** sur `splashScreenColor`, avec `splashScreenFadeOutDuration` réglable. Affiché nativement dès le lancement (avant même que la WebView soit prête). On contrôle couleur + durée + icône.
- **Splash complet avec tagline** : pour avoir « Préparer. Piloter. Accomplir. » baked-in, on remplace la *splash drawable* du projet Android généré par une **image de splash complète** (logo + tagline sur fond Deep Mission), ou on personnalise l'API `SplashScreen` Android 12+. C'est une édition côté projet natif (Android Studio), faite **une fois**.

→ Contrairement à la PWA, ici le splash est natif : **0 dépendance au temps de chargement web**. Il s'affiche frame 1 et se fond quand la PWA est prête.

## 3. Pré-requis

- **Compte Google Play Console** : 25 $ une fois.
- **JDK 17 + Android SDK** (Bubblewrap peut les installer/gérer).
- **Node** (déjà là) pour Bubblewrap CLI.
- **Clé de signature** (keystore) — à générer et **sauvegarder précieusement** (perte = impossible de mettre à jour l'app).
- **Fichier de vérification de domaine** `assetlinks.json` (voir §5).
- Une **fiche Play** : icône, captures, description, **politique de confidentialité** (on a déjà `/legal`) et support (`/support`).

## 4. Étapes (Bubblewrap)

```bash
npm i -g @bubblewrap/cli

# Génère le projet Android depuis le manifest live
bubblewrap init --manifest https://trailcockpit.run/manifest.json
# → demande : couleur splash, couleur thème, nom, package id (ex: run.trailcockpit.twa),
#   icône (512), maskable, splashScreenFadeOutDuration, etc.

bubblewrap build       # produit app-release-signed.aab (+ apk de test) et la clé
bubblewrap install     # installe l'APK de test sur un device branché (validation)
```

- Cibler **Android 15 / API level 35** (exigence Play 2026 pour nouvelles apps et mises à jour — cf. §8). Bubblewrap récent le fait ; vérifier `targetSdkVersion` dans `twa-manifest.json` / `build.gradle`.
- Format d'upload : **AAB** (Android App Bundle).

## 5. Digital Asset Links (vérification de domaine)

Pour retirer la barre d'URL (mode TWA « vérifié »), le domaine doit prouver qu'il autorise l'app :

- Bubblewrap génère le contenu (`assetlinks.json`) avec l'empreinte SHA-256 de la clé de signature **+ celle de Play App Signing**.
- À déposer sur le site à : **`web/public/.well-known/assetlinks.json`** → servi à `https://trailcockpit.run/.well-known/assetlinks.json`.
- ⚠️ Le `middleware.ts` doit laisser passer `/.well-known/*` (aujourd'hui le matcher exclut `_next`, `favicon`, `icons`, `manifest`, `launch` — **ajouter `.well-known`** sinon le fichier passe par `getUser()` ; idéalement l'exclure).

Sans assetlinks correct → l'app s'ouvre avec une barre d'adresse Chrome (moche), mais fonctionne.

## 6. Assets : ce qu'on a déjà / ce qu'il faut

| Besoin TWA | État | Action |
|---|---|---|
| Icône 512 (launcher) | ✅ `icon-512.png` (variante A) | réutilisable |
| Icône maskable (adaptive) | ✅ `maskable-512.png` | réutilisable |
| Couleur thème / fond | ✅ `#FF7900` / `#0B0F14` (manifest) | réutilisable |
| Splash (icône centrée) | ✅ via icône + bg | OK par défaut |
| **Splash complet (logo + tagline)** | ⚠️ à produire | image splash + édit projet natif |
| Feature graphic Play (1024×500) | ❌ | à créer |
| Captures d'écran téléphone | ❌ | à faire (≥ 2) |
| Politique de confidentialité | ✅ `/legal` | lien dans la fiche |

On a déjà la **géométrie du glyphe** (`logo-svg.ts`) → on peut générer l'image de splash complète (logo + tagline) avec le même pipeline `sharp` que le pack d'icônes.

## 7. Maintenance / mises à jour

- **Contenu web** : déploiement Vercel habituel → reflété **instantanément** dans le TWA (c'est la PWA live).
- **Coquille native** (splash, icône, nom, permissions, bump targetSdk) : nécessite un **nouveau build AAB + upload Play + review** (quelques heures à ~1 jour).
- **targetSdk** : Google relève l'exigence ~chaque année → 1 rebuild/an minimum pour rester publiable.

## 8. Limites & pièges

- **Exigence API Play (2026)** : nouvelles apps & mises à jour doivent cibler **Android 15 (API 35)+**. (Source ci-dessous.)
- **Compte développeur** : 25 $ + (pour comptes perso récents) parfois exigence de test fermé avant prod.
- **iOS non couvert** : un TWA est Android-only. Pour iOS, l'équivalent serait un wrapper WKWebView maison (plus lourd, règles App Store plus strictes) — hors scope ici.
- **Clé de signature** : à ne jamais perdre. Activer **Play App Signing** (Google garde la clé d'upload).
- **Le splash TWA reste une image** (pas d'animation web). La tagline doit être dans l'image (ou via l'API SplashScreen native).

## 9. Effort estimé

- **MVP (splash icône + Play)** : ~½ journée (init Bubblewrap, assetlinks, build, fiche minimale, upload).
- **Splash complet (logo + tagline baked-in)** : +2-3 h (image splash + édition projet natif + rebuild).
- **Fiche Play soignée** (captures, feature graphic, descriptions FR/EN) : +2-3 h.

## 10. Recommandation

- Si l'objectif est **uniquement** un meilleur splash : le TWA est la **seule** voie d'un contrôle total, mais c'est un projet natif/Play à part entière. À ne lancer que si on veut **aussi** le Play Store (sinon le `/launch` cache-first déjà en place est le meilleur compromis web).
- Si on y va : commencer par le **MVP TWA** (splash icône centrée sur Deep Mission + fondu court) pour valider la chaîne, puis itérer vers le **splash complet** avec tagline.

**Prochaines étapes concrètes (si go) :**
1. Créer/choisir le `packageId` (ex. `run.trailcockpit.app`).
2. `bubblewrap init` depuis le manifest live.
3. Générer + déposer `web/public/.well-known/assetlinks.json` (+ exclure `.well-known` du middleware).
4. Produire l'image de splash complète (pipeline `sharp` existant).
5. Build AAB, test sur device, fiche Play, upload.

## Sources
- [Meet Google Play's target API level requirement — developer.android.com](https://developer.android.com/google/play/requirements/target-sdk)
- [Bubblewrap CLI README — GoogleChromeLabs](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md)
- [Trusted Web Activities Quick Start (v2) — developer.android.com](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2)
- [From PWA to Play Store: Bubblewrap & TWA — Medium](https://medium.com/@abusomwansantos/from-pwa-to-play-store-a-technical-guide-to-bubblewrap-and-twa-b244d1a626e6)
