# Spécificité course — mapping objectif → types de séances (Mode Mission)

> **Status: Implémenté** · 2026-06-13 · Code : `web/lib/mission/race-profile.ts` + `session-advisor.ts` (selectQuality/longSession) + `MissionPlan.tsx`. Étend le moteur de suggestion (cf. `2026-06-13-onglet-plan-mode-mission-design.md`).

## Problème

Le moteur de suggestion actuel est générique : la séance de qualité est **toujours un seuil**, le D+ de la sortie longue est une **constante (~20 m/km)**, et rien ne dépend de la **course objectif**. Un 10 km route, un marathon, un trail vallonné et un ultra de montagne reçoivent les mêmes types de séances. On veut **adapter les séances proposées au profil de la course visée** — tout en restant déterministe (pas d'IA).

## Décisions (validées avec Franck)

- **Portée A+B** : (A) profil course → **type de séance de qualité** + **D+/taille des sorties longues** ; (B) séance **« allure course »** en phase spécifique quand l'objectif de temps est connu.
- **Catégorisation par distance + D+/km** (chiffres réels) ; le champ `RaceType` ne sert que de **repli/renfort** (un « trail » peut être plat ou montagneux).
- Reste **rule-based**. S'insère dans le moteur existant (1 qualité + 1 sortie longue / semaine). **Périodisation fine par phase = hors périmètre** (option C, plus tard / Coach IA).

## Module `lib/mission/race-profile.ts` (nouveau, pur)

```ts
import type { Race, RaceType, SessionType } from '@/types/plan'

export type Relief = 'flat' | 'rolling' | 'mountain'
export type DistanceClass = 'short' | 'mid' | 'long' | 'ultra'

export type RaceProfile = {
  relief: Relief
  distanceClass: DistanceClass
  dPlusPerKm: number               // relief réel borné [0,80], pour le D+ des SL
  goalPaceMinPerKm: number | null   // targetDurationMin / distance (sinon null)
  qualityKinds: SessionType[]       // types de qualité privilégiés (ordre = priorité)
  longRunMaxMin: number             // plafond durée sortie longue
}

export function raceProfile(race: Race | null): RaceProfile
```

**Dérivation :**
- `ratio = elevation / max(1, distance)` ; `dPlusPerKm = clamp(round(ratio), 0, 80)`.
- **relief** : `ratio < 15` → `flat` · `15 ≤ ratio < 35` → `rolling` · `≥ 35` → `mountain`. Renfort `RaceType` : `skyrace` → au moins `mountain` ; `ultra` → au moins `rolling`.
- **distanceClass** : `≤ 15` → `short` · `≤ 42` → `mid` · `≤ 80` → `long` · `> 80` → `ultra`. Renfort : `RaceType === 'ultra'` → au moins `long`.
- **goalPaceMinPerKm** : `race.targetDurationMin / race.distance` si `targetDurationMin > 0`, sinon `null`.
- **longRunMaxMin** : `short` 90 · `mid` 150 · `long` 210 · `ultra` 240.
- **qualityKinds** (mapping objectif → qualité) :

| relief \ distance | court | moyen / long / ultra |
|---|---|---|
| **flat** | `['fractionne','seuil_tempo']` | `['seuil_tempo','fractionne']` |
| **rolling** | `['seuil_tempo','cotes']` | `['seuil_tempo','cotes']` |
| **mountain** | `['cotes','seuil_tempo']` | `['cotes','seuil_tempo']` |

**Sans course (`race === null`)** → profil neutre = comportement actuel : `relief='flat'`, `distanceClass='mid'`, `dPlusPerKm=20`, `goalPaceMinPerKm=null`, `qualityKinds=['seuil_tempo']`, `longRunMaxMin=120`.

## Intégration moteur (`session-advisor.ts`)

`AdviceContext` reçoit `raceProfile: RaceProfile` (toujours fourni, neutre sans course).

**Nouveaux builders de séance** (en plus de `easySession`, `qualitySession`(seuil), `longSession`) :
- `vmaSession()` → `{ type:'fractionne', titleKey:'sessionVMA', durationMin:60, distanceKm:11, intensity:5, reasonCode:'vma-speed' }` (titre i18n « 10×400m VMA »).
- `cotesSession()` → `{ type:'cotes', titleKey:'sessionCotes', durationMin:60, distanceKm:10, intensity:4, elevationM:350, reasonCode:'hill-work' }` (titre « 6×2min côtes »).
- `racePaceSession(profile)` → `{ type:'course', titleKey:'sessionRacePace', durationMin:55, distanceKm: round(55 / ((goalPaceMinPerKm ?? 5.5) + 0.5)), intensity:3, reasonCode:'race-pace' }` — durée 55' (échauffement + 3×10' à l'allure objectif + retour), distance dérivée de l'allure moyenne (objectif légèrement ralenti par l'échauffement). Titre « Allure course 3×10' ».
- `qualitySession` (seuil) inchangé.

**Sélection de la séance de qualité du jour** (remplace l'actuel « toujours seuil ») :
1. Si phase = `specifique` **et** `goalPaceMinPerKm != null` → `racePaceSession` (B).
2. Sinon → on prend dans `qualityKinds` le type d'indice `weekParity % qualityKinds.length`, où `weekParity` = n° de semaine ISO de `todayISO` (→ alternance des types au fil des semaines, ex. VMA une semaine / seuil la suivante). Mapping type→builder : `fractionne→vmaSession`, `cotes→cotesSession`, `seuil_tempo→qualitySession`.

Les autres règles (fraîcheur → easy/repos ; pas 2 qualités d'affilée ; qualité en semaine ; affûtage allégé) **restent inchangées**.

**Sortie longue** (`longSession`) : le D+ devient `round(km * raceProfile.dPlusPerKm)` (au lieu de `km*20`), et la durée est **plafonnée** à `raceProfile.longRunMaxMin`.

## Câblage UI (`MissionPlan.tsx`)

`MissionPlan` calcule `raceProfile(race)` et le passe dans le contexte du moteur (`ctx`). Aucune autre logique UI : le héros et « Ma semaine » affichent déjà titre / durée·distance·D+ ; le **curseur** gère déjà ces séances (les « N×… » VMA/côtes/allure tombent dans le levier répétitions, les SL à D+ dans le levier D+).

## i18n (`fr.ts` + `en.ts`)

- `sessionTitles` : `sessionVMA` (« 10×400m VMA »), `sessionCotes` (« 6×2min côtes »), `sessionRacePace` (« Allure course 3×10' »).
- `reasonChips` : `vma-speed` (« VMA »), `hill-work` (« côtes »), `race-pace` (« allure course »).
- `reasonWhy` : phrases courtes (« Travail de VMA pour la vitesse de base. » / « Côtes : spécifique au dénivelé de ta course. » / « À l'allure de ta course objectif. »).
- **Zéro jargon TSB** (cohérence avec l'onglet Plan).

## Fichiers touchés

| Fichier | Action |
|---|---|
| `web/lib/mission/race-profile.ts` | **nouveau** — `raceProfile()` pur |
| `web/lib/mission/session-advisor.ts` | builders VMA/côtes/allure + sélection qualité via `qualityKinds`/phase + D+ SL via profil ; `AdviceContext += raceProfile` |
| `web/components/mission/MissionPlan.tsx` | calcule + passe `raceProfile(race)` |
| `web/lib/i18n/dictionaries/{fr,en}.ts` | nouvelles clés titres/raisons |
| `web/__tests__/lib/mission/race-profile.test.ts` | **nouveau** |
| `web/__tests__/lib/mission/session-advisor.test.ts` | cas spécificité |

Pas de migration Supabase.

## Tests

- `race-profile` : 10k route (plat, court) → `qualityKinds[0]='fractionne'` ; marathon route → `seuil_tempo` + `goalPace` calculé ; trail vallonné → `cotes` présent ; skyrace/ultra montagne → `relief='mountain'`, `distanceClass='ultra'`, `dPlusPerKm` élevé ; sans course → profil neutre (`seuil_tempo`, 20, 120).
- `session-advisor` : la qualité suit `qualityKinds` (10k → VMA/seuil selon la semaine ; montagne → côtes) ; D+ de la sortie longue ∝ `dPlusPerKm` ; phase spécifique + `goalPace` → `racePaceSession`.
- Suites Jest ciblées uniquement (faux positifs i18n pré-existants).

## Hors périmètre

- **Périodisation fine par phase** (emphase différente foncier/spécifique/affûtage), back-to-back ultra (option C).
- Ajustement par la fatigue au-delà du « high-fatigue → easy » actuel.
- Suggestion vélo/natation spécifique (le moteur reste course-à-pied).
