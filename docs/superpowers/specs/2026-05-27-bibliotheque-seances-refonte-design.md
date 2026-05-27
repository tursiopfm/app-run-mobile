# Refonte de la bibliothèque de séances (onglet Plan)

> Status: Spec · 2026-05-27 · Cible code: `web/lib/training/session-templates.ts`

## Contexte & problème

L'onglet Plan expose une bibliothèque de séances (`SessionTemplate`) qu'on glisse-dépose sur le calendrier pour créer une `PlannedSession`. Le modèle prévoit un champ `defaultZones?: SessionZone[]` qui décrit la structure interne d'une séance (échauffement / corps / retour au calme, avec containers `RepeatZone` pour les séries). Au drop, `template.defaultZones` est recopié dans `session.zones` (`web/app/(main)/plan/PlanClient.tsx:126`).

**Problème observé** : aucun des 27 templates système actuels ne définit `defaultZones`. Lorsqu'on glisse "10×400m VMA" sur le calendrier puis qu'on ouvre l'éditeur, la section **Structure** est vide. L'utilisateur doit reconstruire à la main warmup + 10 répétitions + cooldown à chaque fois.

En parallèle, la liste actuelle (27 séances, 2-3 par type) manque :
- de progressivité court → long dans chaque famille,
- de séances VMA courte type 30/30,
- de séances spécifiques route (allure marathon, 2×4 km allure semi),
- de variantes de récupération,
- de séances trail avec bloc spécifique en cœur de SL.

## Objectifs

1. Faire en sorte que le drop d'une séance fractionné / seuil / côtes pré-remplisse la Structure (warmup + RepeatZone + cooldown).
2. Étendre la bibliothèque à ~50 séances cohérentes, couvrant équitablement trail/ultra et route/piste, ancrées dans la littérature (Daniels, Canova, Balducci, Heubi, Magness).
3. Garantir la progressivité (court → long) dans chaque famille de séance.
4. Ne pas casser les templates custom de l'utilisateur ni ses masquages localStorage.

## Non-objectifs

- Pas de modification du modèle de données (`SessionTemplate`, `TrainingZone`, `RepeatZone`).
- Pas de modification du DnD ni du calendrier ni de l'éditeur.
- Pas de personnalisation par VMA / profil utilisateur — tout en niveau d'intensité 1-5 (modifiable après drop).
- Pas de séances de natation autres que les 2 existantes.

## Décisions de conception

### Échelle d'intensité

`intensityMode: 'level'` partout, mapping :

- 1 : Récup / EF très lente (Z1)
- 2 : Endurance fondamentale (Daniels E)
- 3 : Tempo / Allure marathon (Daniels M)
- 4 : Seuil (Daniels T)
- 5 : VMA / Intervals (Daniels I et R)

L'utilisateur peut convertir en allure (`paceSecPerKm`) dans l'éditeur après le drop.

### Convention de structure par type

| Type | Warmup | Corps | Cooldown |
|---|---|---|---|
| `fractionne` | 20 min, intensité 2 | `RepeatZone` (effort + récup trot intensité 1) | 10 min, intensité 2 |
| `seuil_tempo` intervalles | 20 min, intensité 2 | `RepeatZone` (effort intensité 4 + récup trot) | 10 min, intensité 2 |
| `seuil_tempo` tempo continu | 20 min, intensité 2 | 1 main intensité 3-4 | 10 min, intensité 2 |
| `cotes` courtes (≤ 1 min) | 20 min, intensité 2 | `RepeatZone` (côte intensité 5 + récup descente trot) | 10 min, intensité 2 |
| `cotes` longues (≥ 2 min) | 25 min, intensité 2 | `RepeatZone` (côte intensité 4 + descente trot) | 10 min, intensité 2 |
| `sortie_longue` simple | — | 1 main intensité 2 | — |
| `sortie_longue` progressive | — | main intensité 2 + main intensité 3 (dernier ¼) | — |
| `sortie_longue` avec bloc | — | main intensité 2 + bloc intensité 3-4 + main intensité 2 | — |
| `footing`, `runtaf`, `velotaf`, `velo` continue | — | 1 main | — |
| `natation` continue | — | 1 main intensité 2 | — |
| `natation` fractionnée | — | `RepeatZone` (50 m effort + récup) | — |
| `course` | — | 1 main paramétrable | — |
| `renfo`, `musculation` | — | **aucune zone** (séance hors course, durée seule) | — |

### Préservation des IDs existants

Quand une séance de la nouvelle liste correspond à une séance déjà présente (même titre / structure / intensité), on **réutilise l'ID existant**. Pour les nouvelles séances, IDs neufs. Bénéfice : les `hiddenSystemTemplateIds` du localStorage restent valides. Mapping en annexe.

## Contenu de la nouvelle bibliothèque (~50 séances)

> Légende : `int` = intensité (1-5), `D+` = dénivelé positif en mètres.

### Récupération & footing (6)

| ID | Titre | Durée | Distance | int | Structure |
|---|---|---|---|---|---|
| `ft-recup-30` | Footing récup 30min | 30 | 4 km | 1 | 1 main 30 min int 1 |
| `ft-decrassage-20` | Décrassage 20min | 20 | 3 km | 1 | 1 main 20 min int 1 |
| `ft-30` | Footing 30min | 30 | 5 km | 2 | 1 main 30 min int 2 |
| `ft-45` | Footing 45min | 45 | 7.5 km | 2 | 1 main 45 min int 2 |
| `ft-1h` | Footing 1h | 60 | 10 km | 2 | 1 main 60 min int 2 |
| `ft-progressif-1h` | Footing progressif 1h | 60 | 10 km | 2 | 45 min int 2 + 15 min int 3 |

### Sortie longue (5)

| ID | Titre | Durée | Distance | D+ | int | Structure |
|---|---|---|---|---|---|---|
| `sl-1h30` | SL 1h30 vallonnée | 90 | 15 | 400 | 2 | 1 main 90 min int 2 |
| `sl-2h-progressive` | SL 2h progressive | 120 | 20 | 500 | 2 | 90 min int 2 + 30 min int 3 |
| `sl-2h30` | SL 2h30 endurance | 150 | 22 | 600 | 2 | 1 main 150 min int 2 |
| `sl-3h-spe` | SL 3h spé trail | 180 | 28 | 900 | 3 | 60 min int 2 + 60 min int 3 (relances en côtes) + 60 min int 2 |
| `sl-bloc-marathon` | SL 1h45 bloc allure marathon | 105 | 22 | 100 | 3 | 45 min int 2 + 30 min int 3 + 30 min int 2 |

### Tempo / Allure marathon (3)

| ID | Titre | Durée | Distance | int | Structure |
|---|---|---|---|---|---|
| `te-tempo-30` | Tempo continu 30min | 60 | 10 | 3 | WU 20 min int 2 + 30 min int 3 + CD 10 min int 2 |
| `te-2x15` | 2×15min tempo | 65 | 11 | 3 | WU 20 + Repeat 2× (15 min int 3 + 3 min trot int 1) + CD 10 |
| `te-am-45` | Allure marathon 45min | 75 | 13 | 3 | WU 20 + 45 min int 3 + CD 10 |

### Seuil (6)

| ID | Titre | Durée | Distance | int | Structure (corps) |
|---|---|---|---|---|---|
| `se-4x8` | 4×8min Seuil | 65 | 11 | 4 | Repeat 4× (8 min int 4 + 2 min trot int 1) |
| `se-3x10` | 3×10min Seuil | 65 | 11 | 4 | Repeat 3× (10 min int 4 + 2 min trot int 1) |
| `se-2x20` | 2×20min Seuil | 75 | 13 | 4 | Repeat 2× (20 min int 4 + 3 min trot int 1) |
| `se-6x6` | 6×6min Seuil | 70 | 12 | 4 | Repeat 6× (6 min int 4 + 1 min 30 trot int 1) |
| `te-40min` | Tempo 40min continu | 70 | 12 | 4 | 1 main 40 min int 4 (seuil bas) |
| `se-2x4km-semi` | 2×4km allure semi | 70 | 12 | 4 | Repeat 2× (4 km int 4 + 4 min trot int 1) |

WU = 20 min int 2 / CD = 10 min int 2 pour toutes ces séances.

### VMA courte (4)

| ID | Titre | Durée | Distance | int | Structure (corps) |
|---|---|---|---|---|---|
| `fr-30-30` | 20×30/30 | 50 | 7 | 5 | Repeat 20× (30 s int 5 + 30 s int 1) |
| `fr-45-15` | 12×45/15 | 50 | 7 | 5 | Repeat 12× (45 s int 5 + 15 s int 1) |
| `fr-10x200` | 10×200m | 55 | 7 | 5 | Repeat 10× (200 m int 5 + 1 min trot int 1) |
| `fr-15x300` | 15×300m | 65 | 9 | 5 | Repeat 15× (300 m int 5 + 45 s trot int 1) |

WU = 20 min int 2 / CD = 10 min int 2.

### VMA longue (6)

| ID | Titre | Durée | Distance | int | Structure (corps) |
|---|---|---|---|---|---|
| `fr-10x400` | 10×400m VMA | 65 | 9 | 5 | Repeat 10× (400 m int 5 + 1 min trot int 1) |
| `fr-6x500` | 6×500m VMA | 60 | 8 | 5 | Repeat 6× (500 m int 5 + 1 min 15 trot int 1) |
| `fr-5x1000` | 5×1000m VMA | 70 | 10 | 5 | Repeat 5× (1000 m int 5 + 2 min trot int 1) |
| `fr-4x1500-5k` | 4×1500m allure 5km | 75 | 11 | 5 | Repeat 4× (1500 m int 5 + 2 min 30 trot int 1) |
| `fr-3x6min` | 3×6min VMA | 65 | 10 | 5 | Repeat 3× (6 min int 5 + 2 min 30 trot int 1) |
| `fr-5x3min` | 5×3min VMA | 65 | 10 | 5 | Repeat 5× (3 min int 5 + 1 min 30 trot int 1) |

WU = 20 min int 2 / CD = 10 min int 2.

### Côtes (6)

| ID | Titre | Durée | Distance | D+ | int | Structure (corps) |
|---|---|---|---|---|---|---|
| `co-10x30s` | 10×30s côtes raides | 55 | 8 | 200 | 5 | Repeat 10× (30 s int 5 + 1 min descente int 1) |
| `co-12x45s` | 12×45s côtes | 60 | 9 | 250 | 5 | Repeat 12× (45 s int 5 + 1 min 15 descente int 1) |
| `co-6x2min` | 6×2min côtes | 70 | 10 | 350 | 4 | Repeat 6× (2 min int 4 + 2 min descente int 1) |
| `co-4x4min` | 4×4min côtes longues | 80 | 11 | 400 | 4 | Repeat 4× (4 min int 4 + 3 min descente int 1) ; WU = 25 min |
| `co-bosses-natu` | Sortie bosses 1h30 | 90 | 13 | 600 | 3 | 1 main 90 min int 3 (relances libres) |
| `co-bosses-2h` | Sortie bosses 2h | 120 | 17 | 800 | 3 | 1 main 120 min int 3 |

WU = 20 min int 2 (sauf `co-4x4min` = 25 min) / CD = 10 min int 2.

### Course (3)

| ID | Titre | Durée | int | Structure |
|---|---|---|---|---|
| `cr-cible` | Course objectif | 240 | 4 | 1 main (paramétrable) |
| `cr-prep` | Course de prépa | 90 | 4 | 1 main 90 min int 4 |
| `cr-test-10k` | Test 10km route | 50 | 5 | 1 main 50 min int 5 |

### Cross-training (5)

| ID | Titre | Durée | Distance | D+ | int |
|---|---|---|---|---|---|
| `velo-1h30-eb` | Vélo 1h30 endurance | 90 | 40 | 300 | 2 |
| `velo-2h-vallonne` | Vélo 2h vallonnée | 120 | 55 | 800 | 3 |
| `vt-1h` | Velotaf 1h | 60 | 20 | — | 2 |
| `nat-45min-endurance` | Natation 45min continue | 45 | 2 | — | 2 |
| `nat-1h-fract` | Natation 1h fractionnée | 60 | 2.5 | — | 4 |

Structure : 1 main pour les continues ; pour `nat-1h-fract`, Repeat 16× (50 m int 4 + 15 s récup int 1).

### Runtaf (2)

| ID | Titre | Durée | Distance | int |
|---|---|---|---|---|
| `rt-aller` | Runtaf aller 30min | 30 | 5 | 2 |
| `rt-double` | Runtaf A/R 1h | 60 | 10 | 2 |

### Renfo / Musculation (4)

| ID | Titre | Durée | int | Structure |
|---|---|---|---|---|
| `renfo-30min-trail` | Renfo trail 30min | 30 | 3 | aucune zone |
| `renfo-45min-complet` | Renfo complet 45min | 45 | 3 | aucune zone |
| `muscu-jambes` | Muscu jambes | 60 | 4 | aucune zone |
| `muscu-haut-corps` | Muscu haut du corps | 45 | 3 | aucune zone |

## Mapping IDs (ancien → nouveau)

Tous les IDs actuels sont réutilisés tels quels (même structure de slug). Les changements sont uniquement l'ajout de `defaultZones` et l'ajustement de quelques paramètres.

| Ancien ID | Statut |
|---|---|
| `sl-1h30`, `sl-2h-progressive`, `sl-3h-spe` | Gardé (sl-3h-spe : structure 3 blocs + intensité 3) |
| `fr-6x500`, `fr-10x400`, `fr-3x6min` | Gardé + `defaultZones` ajouté |
| `se-3x10`, `se-2x20`, `te-40min` | Gardé + `defaultZones` ajouté |
| `co-10x30s`, `co-6x2min` | Gardé + `defaultZones` ajouté |
| `co-bosses-natu` | Renommé en `co-bosses-1h30` ? **Non — gardé tel quel** pour préserver les masquages éventuels. Le titre devient "Sortie bosses 1h30". |
| `cr-cible`, `cr-prep` | Gardé |
| `rt-aller`, `rt-double` | Gardé |
| `vt-1h` | Gardé |
| `ft-30`, `ft-45`, `ft-1h` | Gardé |
| `velo-1h30-eb`, `velo-2h-vallonne` | Gardé |
| `nat-45min-endurance`, `nat-1h-fract` | Gardé + `defaultZones` ajouté sur `nat-1h-fract` |
| `renfo-30min-trail`, `renfo-45min-complet`, `muscu-jambes`, `muscu-haut-corps` | Gardés tels quels |

**Nouveaux IDs** : `ft-recup-30`, `ft-decrassage-20`, `ft-progressif-1h`, `sl-2h30`, `sl-bloc-marathon`, `te-tempo-30`, `te-2x15`, `te-am-45`, `se-4x8`, `se-6x6`, `se-2x4km-semi`, `fr-30-30`, `fr-45-15`, `fr-10x200`, `fr-15x300`, `fr-5x1000`, `fr-4x1500-5k`, `fr-5x3min`, `co-12x45s`, `co-4x4min`, `co-bosses-2h`, `cr-test-10k`.

> Note : l'ID `co-bosses-natu` est conservé mais son titre passe de "Sortie bosses 1h30" (déjà ce titre dans l'existant) à inchangé. Aucun rename d'ID.

**Aucune séance retirée** par rapport à l'existant. La règle de masquage est silencieusement tolérante aux IDs orphelins (cf. `BibliothequeSeancesBlock.tsx:77`).

## Architecture & impacts code

### Fichier touché

- `web/lib/training/session-templates.ts` — réécriture complète du tableau `SESSION_TEMPLATES`.

### Aucune autre modif nécessaire

- Le modèle (`SessionTemplate`, `SessionZone`, `RepeatZone`, `RepeatStep`) supporte déjà tout.
- Le DnD recopie déjà `defaultZones` (`PlanClient.tsx:126`).
- L'éditeur (`SessionEditorModal`) lit déjà `zones` et affiche warmup/repeat/cooldown.
- Le stockage Supabase des templates custom est inchangé (`web/lib/plan/storage.ts:354`, `:370`).

### Structure d'une entrée type (exemple `fr-10x400`)

```ts
{
  id: 'fr-10x400',
  type: 'fractionne',
  title: '10×400m VMA',
  defaultDuration: 65,
  defaultDistance: 9,
  defaultIntensity: 5,
  description: '10×400m R=1min trot. Allure VMA. Échauffement 20min + retour au calme 10min.',
  tags: ['VMA', 'piste'],
  defaultZones: [
    {
      id: 'wu',
      kind: 'warmup',
      mode: 'duration',
      durationMin: 20,
      intensity: 2,
      intensityMode: 'level',
      label: 'Échauffement',
    },
    {
      id: 'rep',
      kind: 'repeat',
      repeats: 10,
      skipLastRecovery: true,
      steps: [
        {
          id: 'ef',
          stepKind: 'effort',
          mode: 'distance',
          distanceM: 400,
          intensityMode: 'level',
          intensity: 5,
          label: '400m VMA',
        },
        {
          id: 'rc',
          stepKind: 'recovery',
          mode: 'duration',
          durationMin: 1,
          intensityMode: 'level',
          intensity: 1,
          label: 'Trot 1min',
        },
      ],
    },
    {
      id: 'cd',
      kind: 'cooldown',
      mode: 'duration',
      durationMin: 10,
      intensity: 2,
      intensityMode: 'level',
      label: 'Retour au calme',
    },
  ],
}
```

## Tests

### Unitaires (nouveau fichier `__tests__/lib/training/session-templates.test.ts`)

1. **Tous les IDs sont uniques** — `new Set(SESSION_TEMPLATES.map(t => t.id)).size === SESSION_TEMPLATES.length`.
2. **Tous les types sont des `BuiltinSessionType` valides** — chaque `t.type` est dans `BUILTIN_SESSION_TYPES`.
3. **Cohérence intensité** — `defaultIntensity` ∈ {1, 2, 3, 4, 5}.
4. **Cohérence des structures fractionné/seuil/côtes** — pour chaque template de ces 3 types, `defaultZones` est défini, contient au moins un `RepeatZone` ou un main, et un warmup ≥ 20 min (sauf tempo continu).
5. **Durées warmup** — tous les warmups définis ont `durationMin ≥ 20`.
6. **Templates renfo/musculation** — `defaultZones` est `undefined` (séance hors course).
7. **RepeatZone bien formé** — `repeats ≥ 2`, `steps.length ≥ 1`, chaque step a soit `durationMin` soit `distanceM` selon `mode`.

### Test d'intégration léger

- `__tests__/components/plan/SessionAddSheet.test.tsx` ou équivalent : drop d'un template fractionné → la session créée a un `zones` non vide avec warmup + repeat + cooldown. (Si un test similaire existe déjà, simple update ; sinon création nouvelle.)

## Plan de migration

1. Branche feature : `feat/library-sessions-refonte`.
2. Réécriture de `session-templates.ts`.
3. Ajout des tests unitaires.
4. Build local + `npm test`.
5. Vérification manuelle UI : drop d'un fractionné, d'un seuil, d'une séance de côtes → Structure pré-remplie correctement.
6. PR.

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Séances custom de l'utilisateur cassées par un changement de schéma | Aucun changement de schéma — risk nul. |
| Masquages localStorage perdus | IDs conservés à 100% sur les séances existantes. |
| Allure par défaut inadaptée à un coureur lent/rapide | `intensityMode: 'level'` : l'utilisateur ajuste l'allure dans l'éditeur après le drop. |
| Trop de séances → bibliothèque encombrée | Filtres par type (`FilterBar`) + recherche déjà en place ; affichage limité à 2 par défaut puis "Voir plus" (`BibliothequeSeancesBlock.tsx:29`). |

## Annexe — sources littéraires

- **Jack Daniels**, *Daniels' Running Formula* (3e éd.) — pour la grille E/M/T/I/R et les durées d'intervalles VO2max (3-5 min) et seuil (≥ 20 min cumulés).
- **Renato Canova** — blocs spécifiques en cœur de SL (allure marathon dans SL longue).
- **Pascal Balducci**, *Trail running, l'art de la performance* — côtes longues, séances spé trail, périodisation.
- **Bruno Heubi** — séances clé semi/marathon, 2×20' seuil.
- **Steve Magness**, *The Science of Running* — densité d'entraînement, progression VMA.
- **Frédéric Brigaud** — PPG running, pliométrie, renfo trail.
