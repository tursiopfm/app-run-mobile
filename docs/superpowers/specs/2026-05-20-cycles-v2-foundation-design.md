# Spec — Cycles d'entraînement v2 · Fondation (sub-project A)

> **Status: Implémenté** · 2026-05-20 · Code: web/lib/training/load-patterns.ts, web/lib/training/mesocycle-weeks.ts, web/supabase/migrations/022_cycles_v2_foundation.sql, web/types/plan.ts, web/lib/plan/storage.ts
> **Périmètre strict :** **zero UI**. Migration DB + types + moteur de génération + tests. Les sub-projects B (timeline v2 multi-macros), C (édition accordion) et D (templates de prépa) reposent dessus mais sont des specs séparées.

## Goal

Poser les fondations data + algorithmiques pour passer du module "Cycles" actuel (1 plan actif, 5 types phase, semaines calculées on-the-fly) à un modèle de planification trail/ultra capable d'exprimer :

- **Plusieurs macrocycles** simultanés (un par course objectif), avec statut (`planned`, `active`, `completed`, `archived`) et couleur.
- **Priorité A/B/C** sur les courses (au lieu du seul `is_main` booléen).
- **Focus** libre sur un mésocycle (texte : "Base aérobie", "VMA", "Côtes & D+"…) en plus du type structurel (foncier / dvpt / spé / affût / récup).
- **Pattern de charge** par mésocycle (`progressive_3_1`, `progressive_2_1`, `taper`, `maintenance`, `recovery`, `competition`, `custom`).
- **Semaines persistées** dans une table dédiée `mesocycle_weeks`, avec `is_manual_override` et `week_type` (load / deload / recovery / taper / race / transition / custom).

L'objectif de ce sub-project A est de livrer ces fondations sans toucher l'UI existante — `StructurePrepaBlock`, `PhaseEditorModal`, `ChargePlanifieeBlock` et `VueSemaineBlock` continuent de fonctionner comme aujourd'hui.

## Problème actuel

Le module "Cycles de préparation" actuel a 3 limites structurelles :

1. **Un seul `training_plan` actif** (le plus récent) — impossible de gérer deux prépas qui se chevauchent ou la coexistence d'une saison + prépas internes.
2. **Pas de notion de priorité course** — `races.is_main` booléen ne distingue pas une course A (objectif principal) d'une course B (sérieuse mais sans taper) ou C (entraînement).
3. **Pas de moteur de génération** — `autoDistributePhases()` distribue uniquement les **bornes** des phases ; les **cibles hebdo** sont éditées à la main dans le tableau du `StructurePrepaBlock`, sans logique de pattern de charge (progressive, 3:1, 2:1, taper).

De plus, les semaines sont calculées on-the-fly via `getPhaseWeeks()` avec un fallback sur un JSONB `phases.weekly_targets`. Ce modèle ne permet pas de stocker des métadonnées par semaine (type, override manuel, commentaire) ni d'appliquer la règle "ne pas écraser une semaine éditée à la main lors d'une régénération".

## Décisions structurantes (validées en brainstorming)

| # | Décision | Raison |
|---|---|---|
| 1 | N macrocycles, 1 par course | Plus fidèle à la planif coach que 1 macrocycle global |
| 2 | Garder 5 types phase + ajouter colonne `focus` libre | Pas de breaking change UI ; les 5 grandes familles couvrent tout |
| 3 | Nouvelle table `mesocycle_weeks` (pas JSONB) | Permet FK, index, query cross-phase ; expressive (week_type, override) |
| 4 | Backfill immédiat des semaines dans la migration | Pas de race condition lazy ; code TS plus simple |
| 5 | Nouvelle colonne `races.priority` ; `is_main` reste pour compat | Migration douce, pas de touch sur tous les consommateurs `is_main` |
| 6 | Patterns V1 : `progressive_3_1`, `progressive_2_1`, `taper` + triviaux (`maintenance`, `recovery`, `competition`, `custom`) | Les 3 demandés explicitement + 4 triviaux qui complètent le modèle |
| 7 | Zero UI dans ce sub-project | Évite les régressions sur le Plan existant ; UI consolidée dans B/C/D |

## Architecture & fichiers

```
web/
  supabase/migrations/
    022_cycles_v2_foundation.sql           ← NEW (idempotente, ~120 lignes)
  types/
    plan.ts                                 ← EXTEND (Race.priority, Phase.focus/loadPattern,
                                                       TrainingPlan.status/color/templateId,
                                                       new types MesocycleWeek, LoadPattern, WeekType)
  lib/
    training/
      phases.ts                             ← UNCHANGED (continue à servir l'UI existante)
      load-patterns.ts                      ← NEW (moteur pur, sans dépendance Supabase/React)
      mesocycle-weeks.ts                    ← NEW (storage R/W de la nouvelle table)
    plan/
      storage.ts                            ← EXTEND (raceFromRow lit priority,
                                                       saveCurrentPlan appelle regenerateWeeks
                                                       pour chaque phase qui n'a pas d'override)
  __tests__/
    lib/training/load-patterns.test.ts      ← NEW (~10 cas)
    lib/training/mesocycle-weeks.test.ts    ← NEW (~5 cas, Supabase mocké)
```

**Principe d'isolation** : `load-patterns.ts` est un module **pur** (entrée: pattern + baseline + weekCount → sortie: GeneratedWeek[]). Aucune dépendance Supabase ni React, testable trivialement. `mesocycle-weeks.ts` encapsule toute la R/W de la nouvelle table et orchestre la règle `is_manual_override`.

## Migration 022

`web/supabase/migrations/022_cycles_v2_foundation.sql` — une seule migration idempotente, 5 blocs :

### Bloc 1 — Priorité sur races

```sql
alter table races
  add column if not exists priority text not null default 'C'
    check (priority in ('A','B','C'));

-- Backfill : is_main=true devient priorité A.
update races set priority = 'A' where is_main = true and priority = 'C';
```

`is_main` reste pour compat — non-touché, non-déprécié dans ce sub-project. Le code TS pourra le mettre à jour pendant un temps en miroir (priority='A' ⇒ is_main=true) si besoin pour ne rien casser dans `ObjectifCourseBlock` qui lit `is_main`.

### Bloc 2 — Focus libre sur phases

```sql
alter table phases
  add column if not exists focus text;  -- libre : 'Base aérobie', 'VMA', 'Côtes'…
```

Le CHECK existant sur `phases.type` (5 valeurs : foncier, developpement, specifique, affutage, recuperation) **n'est pas touché**.

### Bloc 3 — Métadonnées macrocycle sur training_plans

```sql
alter table training_plans
  add column if not exists template_id text,
  add column if not exists status text not null default 'active'
    check (status in ('planned','active','completed','archived')),
  add column if not exists color text;
```

### Bloc 4 — Pattern de charge sur phases

```sql
alter table phases
  add column if not exists load_pattern text not null default 'custom'
    check (load_pattern in (
      'progressive_3_1','progressive_2_1','taper',
      'maintenance','recovery','competition','custom'
    ));
```

### Bloc 5 — Nouvelle table `mesocycle_weeks`

```sql
create table if not exists mesocycle_weeks (
  id                       uuid primary key default gen_random_uuid(),
  phase_id                 uuid references phases(id) on delete cascade not null,
  week_index               integer not null,                 -- 0-based dans la phase
  week_start_date          date not null,
  week_type                text not null default 'load'
    check (week_type in ('load','deload','recovery','taper','race','transition','custom')),
  target_load_tss          integer not null default 0,
  target_volume_km         numeric(8,2) not null default 0,
  target_dplus_m           integer not null default 0,
  comment                  text,
  is_manual_override       boolean not null default false,
  generated_from_pattern   boolean not null default true,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  unique (phase_id, week_index)
);

create index if not exists idx_mesocycle_weeks_phase
  on mesocycle_weeks(phase_id, week_index);

alter table mesocycle_weeks enable row level security;

create policy "mesocycle_weeks_select_via_phase" on mesocycle_weeks for select
  using (exists (
    select 1 from phases ph
    join training_plans tp on tp.id = ph.plan_id
    where ph.id = mesocycle_weeks.phase_id and tp.athlete_id = auth.uid()
  ));
-- idem insert / update / delete avec le même EXISTS.

create trigger mesocycle_weeks_updated_at
  before update on mesocycle_weeks
  for each row execute procedure moddatetime(updated_at);
```

### Backfill des semaines existantes

À la fin de la migration 022, pour chaque phase existante on insère N rows `mesocycle_weeks` (N = nombre de semaines de la phase). Les valeurs reprennent les défauts de la phase et les overrides JSONB `phases.weekly_targets[i]` quand ils existent :

```sql
insert into mesocycle_weeks (
  phase_id, week_index, week_start_date,
  week_type, target_load_tss, target_volume_km, target_dplus_m,
  is_manual_override, generated_from_pattern
)
select
  ph.id,
  gs.week_index,
  (ph.start_date + (gs.week_index * 7))::date,
  'load',
  ph.weekly_charge_target,
  coalesce((ph.weekly_targets->gs.week_index->>'km')::numeric, ph.weekly_distance_km_target),
  coalesce((ph.weekly_targets->gs.week_index->>'d_plus')::integer, ph.weekly_elevation_m_target),
  -- Une row du JSONB qui diffère des défauts est considérée comme override manuel.
  case
    when ph.weekly_targets->gs.week_index is not null then true
    else false
  end,
  true
from phases ph
cross join lateral generate_series(
  0,
  greatest(0, ceil(extract(epoch from (ph.end_date - ph.start_date)) / 604800)::int - 1)
) as gs(week_index)
on conflict (phase_id, week_index) do nothing;
```

Le `on conflict do nothing` rend la migration rejouable sans dupliquer.

### Verification (commentée en fin de fichier)

```sql
-- select table_name from information_schema.tables
--   where table_schema='public' and table_name='mesocycle_weeks';
-- select column_name from information_schema.columns where table_name='races' and column_name='priority';
-- select column_name from information_schema.columns where table_name='phases' and column_name in ('focus','load_pattern');
-- select column_name from information_schema.columns where table_name='training_plans' and column_name in ('status','color','template_id');
```

## Types TypeScript (`web/types/plan.ts`)

### Extensions

```ts
// Race
export type RacePriority = 'A' | 'B' | 'C'
export interface Race {
  // ...existants
  priority: RacePriority   // ← NEW (défaut 'C' depuis la DB ; backfill is_main=true → 'A')
}

// Phase
export type LoadPattern =
  | 'progressive_3_1'
  | 'progressive_2_1'
  | 'taper'
  | 'maintenance'
  | 'recovery'
  | 'competition'
  | 'custom'

export interface Phase {
  // ...existants
  focus?: string            // ← NEW (libre, ex 'Base aérobie', 'VMA', 'Côtes & D+')
  loadPattern: LoadPattern  // ← NEW (défaut 'custom' côté DB)
}

// TrainingPlan
export type MacrocycleStatus = 'planned' | 'active' | 'completed' | 'archived'
export interface TrainingPlan {
  // ...existants
  status: MacrocycleStatus  // ← NEW (défaut 'active')
  color?: string            // ← NEW
  templateId?: string       // ← NEW : 'ultra' | 'trail_court' | 'reprise' | 'custom' | …
}
```

### Nouveaux types

```ts
export type WeekType =
  | 'load' | 'deload' | 'recovery' | 'taper' | 'race' | 'transition' | 'custom'

export interface MesocycleWeek {
  id: string
  phaseId: string
  weekIndex: number           // 0-based
  weekStartDate: string       // ISO YYYY-MM-DD
  weekType: WeekType
  targetLoadTss: number
  targetVolumeKm: number
  targetDplusM: number
  comment?: string
  isManualOverride: boolean
  generatedFromPattern: boolean
}
```

`PhaseWeeklyTarget` (JSONB) reste typé pour compat lecture mais n'est plus écrit en V1 (B/C/D s'en occuperont). Pendant la transition, le storage continue d'écrire le JSONB en miroir des `mesocycle_weeks` correspondants pour ne rien casser dans `getPhaseWeeks()` utilisé par les blocs UI existants.

## Moteur de génération (`web/lib/training/load-patterns.ts`)

### API publique

```ts
export interface PatternInput {
  startDate: string           // ISO de la 1ʳᵉ semaine
  weekCount: number           // nombre de semaines à générer
  baselineLoadTss: number     // charge cible "max" du bloc
  baselineVolumeKm: number    // km cible "max" du bloc
  baselineDplusM: number      // D+ cible "max" du bloc
}

export interface GeneratedWeek {
  weekIndex: number
  weekStartDate: string       // ISO YYYY-MM-DD
  weekType: WeekType
  targetLoadTss: number       // arrondi entier
  targetVolumeKm: number      // arrondi 0.1
  targetDplusM: number        // arrondi entier
  generatedFromPattern: true
  isManualOverride: false
}

export function generateWeeks(
  pattern: LoadPattern,
  input: PatternInput,
): GeneratedWeek[]
```

### Algorithmes par pattern

Les ratios sont des constantes en haut du fichier (`PATTERN_RATIOS`) pour rester testables et tunables :

| Pattern | Cycle de base | Ratios appliqués au baseline | Boucle ? |
|---|---|---|---|
| `progressive_3_1` | 4 sem | [0.80 load, 0.90 load, 1.00 load, 0.65 deload] | oui |
| `progressive_2_1` | 3 sem | [0.85 load, 1.00 load, 0.65 deload] | oui |
| `taper` | weekCount sem | linéaire de 0.85 à 0.40 (weekType `taper`) | non, plafonné au weekCount |
| `maintenance` | 1 sem | [1.00 load] répété | oui |
| `recovery` | 1 sem | [0.50 recovery] répété | oui |
| `competition` | 1 sem | volumes à 0, weekType `race` (1 semaine attendue) | non |
| `custom` | — | retourne `[]` (pas d'auto-génération) | — |

Détails :

- `progressive_3_1` sur 6 semaines → [80%, 90%, 100%, 65%, 80%, 90%] → 4 load, 1 deload, 1 load tronqué (la deload finale du cycle 2 n'est pas atteinte).
- `progressive_2_1` sur 6 semaines → [85%, 100%, 65%, 85%, 100%, 65%] → 4 load, 2 deload.
- `taper` sur 3 semaines → 3 paliers linéaires entre 0.85 et 0.40 : [0.85, 0.625, 0.40]. Sur 4 semaines : [0.85, 0.70, 0.55, 0.40].
- `competition` sur N>1 semaines : 1ère semaine `race`, semaines suivantes ignorées (l'appelant ne devrait pas demander ça, log warn).
- `custom` : le code TS sait reconnaître ce cas et n'appellera jamais `generateWeeks` ; le pattern existe juste pour l'enum.

### Helpers internes (non exportés)

```ts
const PATTERN_RATIOS = {
  progressive_3_1: [
    { ratio: 0.80, type: 'load'   as WeekType },
    { ratio: 0.90, type: 'load'   as WeekType },
    { ratio: 1.00, type: 'load'   as WeekType },
    { ratio: 0.65, type: 'deload' as WeekType },
  ],
  // ... idem 2_1, maintenance, recovery
} as const

function addDaysISO(iso: string, days: number): string { /* parse → UTC → ISO */ }
function roundKm(v: number): number { return Math.round(v * 10) / 10 }
```

## Storage des semaines (`web/lib/training/mesocycle-weeks.ts`)

### API publique

```ts
// Lecture
export async function getWeeksForPhase(phaseId: string): Promise<MesocycleWeek[]>

// (Re)génération depuis le pattern de la phase, PRÉSERVE les overrides par défaut
export async function regenerateWeeks(
  phase: Phase,
  opts?: { forceOverwrite?: boolean },
): Promise<MesocycleWeek[]>

// UPDATE d'une semaine (marque is_manual_override=true automatiquement)
export async function updateWeek(
  weekId: string,
  patch: Partial<Pick<MesocycleWeek,
    'weekType' | 'targetLoadTss' | 'targetVolumeKm' | 'targetDplusM' | 'comment'
  >>,
): Promise<MesocycleWeek>

// Reset d'une semaine (is_manual_override=false, regénère depuis le pattern)
export async function resetWeek(weekId: string): Promise<MesocycleWeek>
```

### Règle `is_manual_override` (le point critique)

**Algorithme de `regenerateWeeks(phase, opts?)`** :

1. Lire les rows actuelles `mesocycle_weeks` de la phase (indexées par `weekIndex`).
2. Calculer le `weekCount` = `phaseWeekCount(phase)` (helper existant dans `phases.ts`).
3. Appeler `generateWeeks(phase.loadPattern, { startDate, weekCount, baseline... })`.
   - Si `phase.loadPattern === 'custom'` → retourner les rows actuelles sans rien changer.
4. Pour chaque semaine générée (index 0..weekCount-1) :
   - Si la row existante a `is_manual_override = true` ET `opts?.forceOverwrite !== true` → **on garde la row existante telle quelle**.
   - Sinon → on UPSERT (`on conflict (phase_id, week_index) do update`) avec les valeurs générées et `is_manual_override = false`, `generated_from_pattern = true`.
5. Supprimer les rows dont `weekIndex >= weekCount` (la phase a été raccourcie). **Note** : on supprime même les rows `is_manual_override=true` dans ce cas — la semaine n'existe plus dans la phase, ses données partent avec. Si on veut un jour "préserver les overrides perdus", ça nécessitera une logique de soft-delete séparée — hors scope V1.
6. Retourner la liste résultante triée par `weekIndex`.

**Conséquence UI (B/C plus tard)** : `updateWeek()` met automatiquement `is_manual_override = true`. Toute régénération future ne touchera plus cette semaine, **sauf** si l'utilisateur déclenche explicitement "Forcer la régénération (écrase mes modifs)" qui appelle `regenerateWeeks(phase, { forceOverwrite: true })`.

### Mappers Supabase row ↔ domain

`mesocycle-weeks.ts` exporte aussi `weekFromRow` et `weekToRow` (snake_case ↔ camelCase, idem pattern de `storage.ts`).

## Intégration storage existant (`web/lib/plan/storage.ts`)

Changements minimaux pour ne pas casser l'UI actuelle :

1. **`raceFromRow` / `raceToRow`** : ajout du champ `priority` (lecture depuis DB). Côté `raceToRow`, on écrit aussi `is_main = (priority === 'A')` en **miroir** pour que `ObjectifCourseBlock` (qui lit `is_main`) continue de marcher pendant la transition. Sub-project C ou D retirera ce miroir.
2. **`planFromRows` / `planToRow`** : ajout des champs `status`, `color`, `templateId`.
3. **`phasesToRows`** : ajout `focus` et `load_pattern`. Pour les phases qui n'ont pas encore de `loadPattern` (lecture depuis JSON legacy ou ancien plan en LS), on écrit `'custom'` par défaut — cohérent avec le default DB.
4. **`saveCurrentPlan`** : après le `insert` des phases, pour chaque phase **qui a un loadPattern ≠ 'custom'**, appeler `regenerateWeeks(phase)`. Pour les phases `custom`, ne pas toucher les rows existantes (cas import / migration).
5. **Pas de nouvelle fonction publique** dans ce sub-project — les lecteurs des semaines (B/C) consommeront `getWeeksForPhase()` exporté par `mesocycle-weeks.ts`.

## Compat & rollout

- **`StructurePrepaBlock`, `PhaseEditorModal`, `ChargePlanifieeBlock`, `VueSemaineBlock`, `ObjectifCourseBlock`** : non touchés. Continuent d'appeler `getPhaseWeeks()` (JSONB + défauts) et `is_main`.
- **Pendant la transition** : `saveCurrentPlan` écrit en **double** — JSONB `phases.weekly_targets` (pour les blocs UI existants) ET rows `mesocycle_weeks` (pour le futur). Sub-project C basculera l'UI sur `mesocycle_weeks` puis suppression du double-écrit.
- **Migration** : à appliquer manuellement dans le Supabase Dashboard (cf. CLAUDE.md). Le code TS tolère la migration non encore appliquée via les patterns existants (`isMissingColumnError` / `isMissingTableError`).
- **Rollback** : `drop table mesocycle_weeks cascade` + drop des colonnes ajoutées. Données existantes (JSONB) intactes.

## Tests

### `__tests__/lib/training/load-patterns.test.ts` (~10 cas)

- `generateWeeks('progressive_3_1', 4 sem)` → [load 80%, load 90%, load 100%, deload 65%].
- `generateWeeks('progressive_3_1', 8 sem)` → 6 load + 2 deload aux indexes 3 et 7.
- `generateWeeks('progressive_3_1', 6 sem)` → [80, 90, 100, 65, 80, 90] (cycle tronqué).
- `generateWeeks('progressive_2_1', 6 sem)` → [85, 100, 65, 85, 100, 65] (4 load, 2 deload).
- `generateWeeks('progressive_2_1', 2 sem)` → [85, 100] (deload pas atteinte).
- `generateWeeks('taper', 3 sem)` → ratios linéaires [0.85, 0.625, 0.40], type `taper`.
- `generateWeeks('taper', 1 sem)` → 1 entrée à 0.85.
- `generateWeeks('maintenance', N)` → toutes à 1.00, type `load`.
- `generateWeeks('recovery', N)` → toutes à 0.50, type `recovery`.
- `generateWeeks('competition', 1)` → 1 entrée volumes à 0, type `race`.
- `generateWeeks('custom', N)` → `[]`.
- `weekStartDate` incrémente bien de 7 jours.
- Arrondis : km à 0.1 près, TSS et D+ à l'entier.

### `__tests__/lib/training/mesocycle-weeks.test.ts` (~5 cas)

Supabase mocké (helper local qui simule le client). Vérifie :

- `regenerateWeeks` UPSERT toutes les rows quand aucune n'a `is_manual_override`.
- `regenerateWeeks` **préserve** une row avec `is_manual_override = true` (les autres sont UPSERTées).
- `regenerateWeeks({ forceOverwrite: true })` écrase **toutes** les rows y compris celles avec override.
- `regenerateWeeks` supprime les rows avec `weekIndex >= weekCount` après raccourcissement de la phase.
- `regenerateWeeks` sur une phase `loadPattern='custom'` retourne les rows existantes sans modification.

## Hors scope (renvoyé à B/C/D)

- **Aucun composant UI** : la modale `PhaseEditorModal`, le tableau hebdo dans `StructurePrepaBlock`, l'accordéon, le sélecteur de macrocycle actif, l'affichage des courses A/B/C sur la timeline → sub-projects B et C.
- **Templates de prépa** (`ultra`, `trail_court`, `reprise`) : juste la colonne `template_id` existe, **pas de génération** depuis un template dans ce sub-project → sub-project D.
- **Warnings pédagogiques** (taper manquant avant A, montée brutale, course A non rattachée) : la donnée existe (`priority`, `loadPattern`, `mesocycle_weeks`) mais l'analyse + affichage → sub-project C.
- **Suppression du JSONB `phases.weekly_targets`** : on garde le double-écrit pendant A/B, on supprime en C ou D quand toute l'UI consomme `mesocycle_weeks`.
- **`is_main` deprecated** : pas dans ce sub-project, le booléen reste écrit en miroir avec `priority='A'`.

## Critères d'acceptation

- Migration 022 appliquée sans erreur sur l'instance Supabase ; verification SQL OK.
- Tous les tests Jest passent (`npm test` dans `web/`).
- `npm run build` passe sans warning TypeScript.
- `npm run lint` passe.
- Le module Plan existant continue de fonctionner exactement comme avant (smoke test manuel : ouvrir l'onglet Plan, créer une course, générer un plan, éditer une cible km/D+ → tout marche).
- Une race créée a sa `priority` lue/écrite en DB ; les races existantes ont `priority='C'` (ou `'A'` si `is_main=true`).
- Pour toute phase d'un plan, un appel à `getWeeksForPhase(phase.id)` retourne N rows (N = nombre de semaines).
- `regenerateWeeks(phase)` avec un `loadPattern` non-custom génère les semaines selon le pattern et préserve les rows `is_manual_override=true`.
