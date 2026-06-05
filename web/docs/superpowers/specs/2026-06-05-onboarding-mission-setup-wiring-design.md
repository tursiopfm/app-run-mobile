# Spec — Brancher l'onboarding « Mission Setup » en production

> Status: Spec validée · 2026-06-05 · Cible: `web/app/onboarding`, `web/components/onboarding/mission-setup`

## Contexte

Deux onboardings coexistent dans le code :

- **Production** : `/onboarding` rend [`OnboardingStrava`](../../../components/onboarding/OnboardingStrava.tsx) — un écran unique (CTA Strava + « Plus tard »), i18n (fr/en), tokens `bg-trail-bg`.
- **Preview** : `/onboarding-preview` rend [`MissionSetupFlow`](../../../components/onboarding/mission-setup/MissionSetupFlow.tsx) — un flow 5 étapes (Bienvenue → Discipline → Mission → Mode → Données), **sans persistance, sans auth**, avec toggle de thème et disclaimers « démo ». Français codé en dur, tokens Deep Mission (`ink-*`).

Le `MissionSetupFlow` collecte 4 réponses (discipline, mission, mode, source de données) dont 3 n'ont **pas encore** de fonctionnalité réelle sur `master` (le « Mode Mission/Expert », l'objet « mission » et le « sport principal » vivent sur des branches non mergées / en preview).

## Objectif

Promouvoir `MissionSetupFlow` comme onboarding de production à `/onboarding`, en **persistant les 4 réponses** mais sans (encore) leur faire piloter de comportement. Seuls la connexion Strava et un flag de complétion gouvernent réellement le parcours. Périmètre choisi : *flow complet, réponses stockées* (livrable rapide, risque faible).

### Hors périmètre

- Construire le « Mode Mission/Expert » applicatif, l'objet « mission », ou le « sport principal ». Les réponses sont stockées pour usage futur, pas appliquées.
- Internationalisation : le flow reste **français codé en dur** pour cette v1 (voir Drift notes).

## Décisions

- **Persistance** : colonnes dédiées sur `profiles` (pas `ui_preferences` JSONB — éviter le read-modify-write d'un JSONB partagé layout/goals).
- **i18n** : FR codé en dur v1, TODO consigné en Drift notes.
- **Source de vérité du gate** : la colonne `onboarding_completed_at` (et elle seule).

## Modèle de données — Migration 033

`web/supabase/migrations/033_profile_onboarding_answers.sql` :

```sql
alter table profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_discipline text,
  add column if not exists onboarding_mission text,
  add column if not exists onboarding_mode text,
  add column if not exists onboarding_data_source text;

-- Backfill : ne pas renvoyer les users existants dans l'onboarding.
-- Un user est « déjà passé » s'il a skippé OU s'il a une connexion Strava.
update profiles p set onboarding_completed_at = now()
where onboarding_completed_at is null
  and (onboarding_skipped = true
       or exists (select 1 from provider_connections pc
                  where pc.user_id = p.id and pc.provider = 'strava'));
```

- `onboarding_completed_at timestamptz` — **gate**. Null = onboarding à faire.
- `onboarding_discipline | onboarding_mission | onboarding_mode | onboarding_data_source text` — réponses brutes, stockées-seulement.
- La colonne `onboarding_skipped` (migrations 026/027) devient **dead** (plus lue par le gate, plus écrite après suppression de `OnboardingStrava`). On la conserve (pas de migration destructive) ; documentée comme dépréciée.

Migration **non auto-appliquée** → rappeler à Franck de coller le SQL dans le Supabase SQL Editor.

## Flux de complétion

`onboarding_completed_at` se pose selon deux chemins :

### Chemin Strava (étape Données → tuile Strava)

Les réponses sont persistées **au fil des sélections** : chaque choix (discipline / mission / mode / import manuel) déclenche un `PATCH /api/profile` du seul champ concerné. La tuile Strava reste donc un simple `<a href="/api/strava/connect?from=onboarding">` (pas de navigation pilotée par JS, pas de `window.location` à mocker en test).

1. L'utilisateur clique la tuile Strava → navigation pleine page vers le endpoint connect. Les réponses déjà choisies sont **déjà en base** (persistées à la sélection).
2. OAuth → [callback](../../../app/api/strava/callback/route.ts). Après l'upsert `provider_connections` réussi, **si `from === 'onboarding'`**, poser `onboarding_completed_at = now()` **et** `onboarding_data_source = 'strava'` sur `profiles`, puis rediriger vers `/dashboard?strava=connected` (comportement `okUrl` inchangé).

→ Les réponses survivent au round-trip OAuth sans persistance ad hoc avant redirection, car écrites dès la sélection.

### Chemin sans Strava (« Lancer le cockpit » / import manuel)

`PATCH /api/profile` avec les 4 réponses **+ `onboarding_complete: true`**. L'API, voyant ce flag, pose `onboarding_completed_at = new Date().toISOString()` **côté serveur** (jamais un timestamp fourni par le client). Puis `router.push('/dashboard')`.

L'étape « Données » reste **skippable** : « Lancer le cockpit » termine l'onboarding même sans source connectée. `onboarding_data_source` enregistre l'intention (`strava` | `manual` | `null`). « Import manuel » dans cette v1 = sélectionner la source `manual` et terminer (pas de flow d'upload GPX/FIT construit ici). Garmin reste désactivé (« Bientôt »).

## API — `/api/profile` (PATCH)

Étendre l'allowlist de [route.ts](../../../app/api/profile/route.ts) :

- Ajouter `onboarding_discipline`, `onboarding_mission`, `onboarding_mode`, `onboarding_data_source`.
- Gérer un champ `onboarding_complete` (booléen, hors allowlist) : si `=== true`, écrire `update.onboarding_completed_at = new Date().toISOString()`.
- `onboarding_completed_at` n'est **pas** dans l'allowlist directe (pas de timestamp client).

## Gate — source de vérité unique

- [dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx) : sélectionner `onboarding_completed_at` dans la requête `profiles`, puis `if (!athleteProfile?.onboarding_completed_at) redirect('/onboarding')`. Retirer le test `!stravaConnection && !onboarding_skipped`.
- [onboarding/page.tsx](../../../app/onboarding/page.tsx) : `if (profile?.onboarding_completed_at) redirect('/dashboard')`. Retirer les tests strava/skipped. Sélectionner les colonnes `onboarding_discipline/mission/mode/data_source` et les passer à `<MissionSetupFlow initialAnswers={…} stravaStatus={searchParams.strava} />` (remplace `<OnboardingStrava />`).

## Composant — adaptation de `MissionSetupFlow`

Retraits (artefacts de preview) :

- Toggle de thème + `useTheme`/`mounted` (et la danse d'hydratation associée).
- Disclaimer « Aperçu — aucune donnée n'est enregistrée dans cette démo. »
- `CompletionScreen` : bouton « Relancer la démo » → CTA réel « Entrer dans le cockpit » qui déclenche le chemin sans-Strava (PATCH + complete + `/dashboard`).

Ajouts :

- Persistance au fil des sélections : chaque tuile (discipline / mission / mode / import manuel) PATCH son champ via un helper `selectAndPersist`. La tuile Strava reste un `<a href>`.
- Handler de complétion `finish()` sur « Entrer dans le cockpit » (chemin sans-Strava : PATCH `onboarding_complete: true` + `router.push('/dashboard')`).
- État de chargement minimal (`busy`) sur le bouton de complétion pendant le `fetch`.
- **Ré-hydratation des réponses** : le composant accepte une prop `initialAnswers` (discipline/mission/mode/data_source lues en DB par la page serveur) pour initialiser son état. Indispensable au chemin d'erreur : sans ça, un retour sur `/onboarding` repartirait avec un état client vide et un PATCH de retry écraserait les réponses déjà sauvegardées avec des `null`.
- **Affichage d'erreur Strava** : le callback peut renvoyer vers `/onboarding?strava=error|already_linked` (échec OAuth ou athlète déjà rattaché — `23505`). La page `/onboarding` passe `stravaStatus={searchParams.strava}` au composant ; quand il est présent, le flow démarre directement sur l'étape « Données » (réponses ré-hydratées via `initialAnswers`) et affiche le message d'erreur correspondant (libellés `errorGeneric` / `errorAlreadyLinked` en français, repris de `OnboardingStrava`).

Inchangé : les 5 étapes, les sélections discipline/mission/mode, la `TrajectoryLine`, les tokens Deep Mission.

## Nettoyage

- Supprimer `web/app/onboarding-preview/page.tsx` (redondant).
- Supprimer `web/components/onboarding/OnboardingStrava.tsx` + `web/__tests__/onboarding/OnboardingStrava.test.tsx`.

Le `stravaCallbackRedirects` ([auth.ts](../../../lib/providers/strava/auth.ts)) renvoie déjà `okUrl = /dashboard` et `errUrl/alreadyLinkedUrl = /onboarding` pour `from=onboarding` — aucun changement nécessaire.

## Tests (proportionnés)

- `MissionSetupFlow` (`__tests__/onboarding/MissionSetupFlow.test.tsx`) : navigation entre étapes ; « Continuer » bloqué tant qu'aucune sélection ; « Entrer dans le cockpit » appelle `fetch` avec `onboarding_complete: true` ; la tuile Strava PATCH **puis** redirige (fetch + `window.location` mockés).
- `/api/profile` : accepte les 4 nouveaux champs ; pose `onboarding_completed_at` ssi `onboarding_complete === true`.

## Migration / déploiement

1. Coller `033_profile_onboarding_answers.sql` dans le Supabase SQL Editor (manuel).
2. Déployer via push GitHub (Vercel auto-deploy).

## Drift notes

- **i18n** : le flow est français codé en dur (régression vs l'ancien onboarding i18n). TODO : extraire vers `dictionaries/{fr,en}.ts` si l'EN redevient une cible.
- **`onboarding_skipped`** : colonne dépréciée, conservée pour compat. Plus lue ni écrite.
- **Réponses inertes** : `onboarding_discipline/mission/mode/data_source` sont stockées mais ne pilotent rien tant que les features correspondantes (sport principal, mission, Mode Mission/Expert) ne sont pas construites.
