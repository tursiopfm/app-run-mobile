# Spec — Rendre l'onboarding « Mission Setup » fonctionnel

> **Status: À implémenter** · 2026-06-08 · Suivi: `tasks/onboarding-fonctionnel-suivi.md`
> Supersede partiellement: `docs/superpowers/specs/2026-06-05-onboarding-mission-setup-wiring-design.md`
> (les réponses ne sont plus inertes).

## Contexte

L'onboarding `/onboarding` ([MissionSetupFlow](../../../components/onboarding/mission-setup/MissionSetupFlow.tsx))
collecte 4 réponses (`onboarding_discipline | onboarding_mission | onboarding_mode | onboarding_data_source`)
mais elles sont **inertes** : stockées dans `profiles`, ne pilotent aucun comportement (cf. spec du 2026-06-05,
section « Réponses inertes »). Seuls la connexion Strava et le flag `onboarding_completed_at` gouvernent le parcours.

Cette spec rend chaque réponse **fonctionnelle**, ajoute une **étape Zones FC** (correctise l'intensité / la charge /
la fraîcheur), et rend les réponses **éditables dans Réglages**.

## Objectif

Que chaque sélection de l'onboarding produise un effet réel et cohérent, sans friction, livrée **par lots
incrémentaux indépendamment vérifiables**.

## Principe d'architecture — « lire comme défaut », FC écrit en direct

- **Mode / Discipline / Mission** : stockés dans les colonnes `onboarding_*` et **lus comme défaut** par leurs
  consommateurs. Les réglages vivants de l'athlète (toggle Mode, réglages sport par bloc, filtres Plan) **surchargent**
  toujours le défaut. Aucune écriture « miroir » : une seule source pour le défaut = la colonne onboarding.
- **Zones FC** : pas de colonne `onboarding_*` dédiée. L'étape FC **écrit directement** dans le vrai profil
  (`hr_zone_method`, `birth_year`, éventuellement `max_hr`), car c'est déjà la source de vérité du système FC existant.
- **Éditabilité (Réglages)** : comme ces réponses pilotent désormais des comportements, elles sont exposées et
  modifiables dans `/settings`. Modifier un `onboarding_*` change le **défaut** ; les surcharges vivantes restent
  prioritaires (avec, pour la discipline, une action « réappliquer les défauts sport »).

## Modèle de données — Migration (nouvelle, à coller dans Supabase SQL Editor)

```sql
-- Objectif daté optionnel (proposition B) : amorcera plus tard la Structure Prépa.
alter table profiles
  add column if not exists onboarding_race_date date;

-- Renommage de l'id mission « marathon » → « route » (libellé « Préparer une course sur route »).
update profiles set onboarding_mission = 'route' where onboarding_mission = 'marathon';
```

- `birth_year` : déjà existant, alimenté par l'étape FC (proposition A).
- Aucune colonne « sport principal » : la discipline est lue depuis `onboarding_discipline` existant.

## Le flow passe à 6 étapes

`Bienvenue → Discipline → Mission → Mode → Zones FC → Données` (`TOTAL = 6`).

L'étape **Zones FC est placée avant Données** : (1) elle donne une raison de connecter Strava (« déduire tes zones
automatiquement ») ; (2) c'est le seul ordre compatible avec les deux chemins de complétion — le chemin Strava termine
l'onboarding **dans le callback serveur** et ne reviendrait jamais sur une étape FC placée après.

---

## ① Discipline → sport par défaut des blocs cockpit

Les blocs cockpit sport-aware (`ActivitiesBlock`, `LastActivityBlock`, `WeeklyStatsBlock`, `GoalsBlock`, `ChargeBlock`,
`HistoryBlock`, `CumulBlock`, `IntensityBlock`) persistent chacun `{ visible: SportKey[]; default: SportKey }` en
localStorage (`cockpit_*_settings`) via le `SportSettingsModal` (« Volume d'activités » → groupe radio
**« Activité par défaut »** : Course / Vélo / Natation / Toutes). On dérive ce `default` de `onboarding_discipline`,
pour **tous** ces blocs à la fois :

| Discipline | `default` SportKey | Effet |
|---|---|---|
| trail | `run` | inchangé (« laisse tous les blocs ») |
| route | `run` | inchangé |
| vélo | `ride` | blocs affichent Vélo par défaut |
| natation | `swim` | blocs affichent Natation par défaut |
| triathlon | `all` | blocs affichent Tous par défaut |

**Mécanisme** : un helper `defaultSportForDiscipline(discipline): SportKey`. `DashboardGrid` reçoit `discipline` (prop
serveur depuis la page) et passe `defaultSport` aux blocs. Chaque bloc résout son sport :
`localStorage override ?? defaultSport ?? DEFAULT_SETTINGS.default`. **Aucun masquage de bloc** ; seule la valeur
`default` (et l'ordre `visible` pour mettre le sport en tête) change. La perso utilisateur en localStorage reste
prioritaire. Pas de seeding localStorage (évite la fragilité multi-appareils).

## ② Mission → cure la bibliothèque Plan + épingle 1 séance clé

- **Renommage** : option mission « Préparer un marathon » → **« Préparer une course sur route »**, desc
  *« 10 km, semi, marathon »*, `id: 'marathon' → 'route'` (backfill SQL ci-dessus). Icône inchangée.
- **Curation biblio** : l'onglet Plan ([BibliothequeSeancesBlock](../../../components/plan/BibliothequeSeancesBlock.tsx))
  lit `onboarding_mission` et présente par défaut une **vue curée** de `SESSION_TEMPLATES` filtrée par `type` de séance
  (= « tout ce qui rentre dans un plan d'entraînement » pour l'objectif) :
  - `route` → `footing`, `seuil_tempo` (seuil/tempo), `fractionne` (VMA), `sortie_longue`, `course` — **exclut** `cotes` ;
  - `trail` → `footing` (vallonnés), `sortie_longue` (avec D+), `seuil_tempo` (tempo), `cotes` (sorties bosses),
    `course` — **exclut** `fractionne` (VMA piste) ;
  - `charge` / `libre` → biblio complète, pas de filtre.
  - **Non destructif** : un toggle « Tout afficher » révèle le reste (cross-training `velo` / `natation` / `renfo` /
    `runtaf` / `velotaf` reste toujours accessible). La curation ne fait que définir la vue par défaut.
- **Séance clé épinglée** en tête de la vue curée : trail → `co-4x4min` (« 4×4min côtes longues — séance clé trail ») ;
  route → `se-2x20` (« 2×20min Seuil — séance clé semi »). Une seule carte mise en avant, le reste suit.

Hors périmètre (confirmé) : générateur de plan daté automatique.

## ③ Mode → défaut `app_mode` + Mission Visible cohérente

- À l'affichage du dashboard, le mode initial = `ui_preferences.app_mode` (réglage vivant) **sinon** `onboarding_mode`
  **sinon** `expert`. Le toggle Réglages ([AppModeToggle](../../../components/settings/AppModeToggle.tsx)) reste maître
  une fois utilisé. Pas d'écriture miroir : `onboarding_mode` n'est lu que comme défaut.
- En Mode Mission, `MISSION_VISIBLE` respecte le **sport par défaut** de la discipline (même helper que ①). Emphase
  légère : si `onboarding_mission = 'charge'`, garantir `charge` + `freshness` dans la sélection Mission.

## ④ Import manuel → différé proprement (phase 2)

L'étape Données conserve la tuile « Import manuel » : pose `onboarding_data_source = 'manual'`, termine l'onboarding,
et **dépose une amorce non bloquante** (bannière dashboard « Ajoute ta première activité » tant qu'aucune activité +
entrée `tasks/backlog.md`). Le **vrai flow d'upload GPX/FIT est un 2ᵉ temps**, implémenté **après** les lots ①–③ et D
(décision Franck). Aucun cul-de-sac entre-temps.

## ⑤ Nouvelle étape Zones FC (anti-friction)

Une décision principale, gros bouton **« Déduire automatiquement (recommandé) »** → écrit `hr_zone_method = 'deduced'`
(la déduction tourne dès l'arrivée des activités Strava — méthode `deduced` existante). Replié dessous, lien
*« Je connais ma FC max »* → **un seul champ** (FC max, ou année de naissance → `auto`) → `hr_zone_method = 'pct_max'`
(ou `auto`). Encart court : *« Tes zones FC alimentent l'intensité, la charge et la fraîcheur. Tu pourras affiner dans
Réglages. »* Étape **skippable** (jamais bloquante).

- **Proposition A — année de naissance** : collectée ici (sert au fallback %FCmax/auto). Écrit `birth_year`.
- Réutilise les libellés/méthodes de [hr-method-meta.ts](../../../lib/health/hr-method-meta.ts) (pas de doublon).

## Proposition B — objectif daté (optionnel)

À l'étape Mission, si `mission ∈ {trail, route}`, afficher un champ **optionnel** « J'ai une date de course » →
`onboarding_race_date`. Aucune obligation. Sert de graine future à la Structure Prépa (hors périmètre de cette spec :
on stocke seulement).

## Proposition D — édition dans Réglages

Section `/settings` « Mon profil sportif » exposant : discipline, mission (+ date course optionnelle), mode. Édition →
`PATCH /api/profile` des colonnes `onboarding_*`. Pour la discipline, bouton « Réappliquer les défauts d'affichage »
qui efface les clés `cockpit_*_settings` localStorage afin que le nouveau défaut sport prenne effet.

## API — `/api/profile` (PATCH)

Ajouter `onboarding_race_date` à l'allowlist. `hr_zone_method`, `birth_year`, `max_hr` déjà présents. Aucun nouveau
endpoint.

## Lots de livraison (incrémental, item par item)

1. **Lot 1 — Flow 6 étapes + Zones FC (⑤ + A) + Mode défaut (③ partie app_mode)**
   Restructure le flow, ajoute l'étape FC, branche `onboarding_mode` comme défaut `app_mode`.
2. **Lot 2 — Discipline → sport par défaut (①)** : helper + prop `defaultSport` sur les blocs sport-aware.
3. **Lot 3 — Mission → curation biblio + séance clé + renommage route (②) + B (date) + Mission Visible (③ reste)**
   + migration SQL.
4. **Lot 4 — Édition Réglages (D)**.
5. **Lot 5 (2ᵉ temps) — Import manuel réel (④)** : flow upload GPX/FIT. Projet séparé, après les lots 1–4.

Chaque lot = une branche feature, tests proportionnés, vérif build Vercel, puis merge master. Le doc de suivi
`tasks/onboarding-fonctionnel-suivi.md` est coché à chaque lot livré (date + commit).

## Tests (proportionnés)

- `MissionSetupFlow` : navigation 6 étapes ; étape FC skippable ; « Déduire auto » PATCH `hr_zone_method='deduced'` ;
  fallback %FCmax PATCH `max_hr`/`birth_year` ; date course optionnelle PATCH `onboarding_race_date`.
- `defaultSportForDiscipline` : mapping pur (5 cas).
- Curation biblio : tri/filtre par mission (trail vs route vs libre) ; séance clé en tête.
- `/api/profile` : accepte `onboarding_race_date`.

## Drift notes

- (à remplir au fil de l'implémentation si le code diverge)
