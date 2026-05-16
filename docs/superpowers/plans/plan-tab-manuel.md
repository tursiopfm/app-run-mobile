# Plan d'implémentation — Onglet Plan (Mode Manuel)

> **Source spec :** `Prompts/prompt-plan-tab-manuel.md`
> **Branche :** `feat/plan-tab-manuel`
> **Mode exécution :** Subagent-driven, 5 tâches séquentielles.

## Findings d'exploration (à respecter pour TOUTES les tâches)

- **DnD :** `@dnd-kit/sortable` via [web/components/blocks/BlockGrid.tsx](web/components/blocks/BlockGrid.tsx) (déjà utilisé dans Cockpit/Charge). Pattern : `DndContext` + `SortableContext` + `useSortable({ id })`. PointerSensor `{ distance: 8 }`. Persistance `${storageKey}_block_order` en localStorage.
- **Container bloc :** wrapper inline `rounded-[12px] bg-trail-card border border-trail-border p-[10px]` — pas de composant `Card` réutilisable, copy-paste du pattern.
- **Couleurs :** tokens Tailwind `trail-*` pour bg/border/text ; valeurs hex via `colors` de [web/lib/design/colors.ts](web/lib/design/colors.ts) (ex `colors.chargeOrange`, `colors.seriesBlue`). **Jamais de hex hardcodés** sauf opacity math (`${color}26`).
- **Police :** Bebas Neue via `style={{ fontFamily: "'Bebas Neue', sans-serif" }}` inline (pas de `next/font`).
- **WorkoutType :** enum dans [web/lib/activities/intensity.ts](web/lib/activities/intensity.ts) → `'sortie_longue' | 'fractionne' | 'seuil_tempo' | 'cotes' | 'course' | 'runtaf' | 'velotaf'`. ⚠️ Utiliser **`seuil_tempo`** (pas `seuil` comme dans le prompt). Labels/couleurs via `SESSION_TYPE_LABELS` / `SESSION_TYPE_COLORS` de [web/lib/activities/indicators.ts](web/lib/activities/indicators.ts). Affichage icône via `<TypeIndicator />`.
- **Persistance :** Supabase d'emblée. Migration SQL à fournir dans `web/supabase/migrations/` mais **NON exécutée automatiquement** — Franck l'applique manuellement via le Dashboard.
- **Page Plan actuelle :** [web/app/(main)/plan/PlanClient.tsx](web/app/(main)/plan/PlanClient.tsx) (550 lignes, données mock). À **remplacer intégralement** par BlockGrid wirant les 6 nouveaux blocs.
- **Tests :** Jest est dispo. Tester uniquement la logique métier (`autoDistributePhases`, `estimateCharge`). Pas de tests UI.

## Conventions globales

- Toute la prose UI en **français**.
- Tous les nouveaux composants sous `web/components/plan/`.
- Types sous `web/types/plan.ts`.
- Logique métier sous `web/lib/training/`.
- Hook data + persistance sous `web/lib/plan/`.
- Pas de Card primitif : chaque bloc embarque son wrapper rounded/card/border/p-10.
- Tous les modals utilisent `createPortal(... document.body)` (pattern vu dans BlockGrid).

---

## Task 1 — Foundations (data + types + lib métier)

**Objectif :** poser les fondations data, types, persistance, et logique métier (phases, templates) avant tout composant UI.

**Fichiers à créer :**

1. **[web/types/plan.ts](web/types/plan.ts)** — Types TypeScript de la spec (Phase, Race, TrainingPlan, PlannedSession, TrainingZone, SessionTemplate, PhaseType, RaceType, SessionStatus, ZoneKind). Importer `WorkoutType` de `web/lib/activities/intensity.ts` (PAS de `SessionType` qui n'existe pas) et l'aliaser : `export type SessionType = WorkoutType`. Importer `IntensityLevel` de `web/lib/activities/intensity.ts`.

2. **[web/supabase/migrations/014_plan.sql](web/supabase/migrations/014_plan.sql)** — Schéma Supabase complet (5 tables : `races`, `training_plans`, `phases`, `planned_sessions`, `session_templates`) + RLS policies (athlete_id = auth.uid). Suivre le format des migrations existantes (header `-- Migration: N - description`, footer `-- Verification:`). Numéro = 014 (les migrations actuelles vont jusqu'à 013).

3. **[web/lib/training/phases.ts](web/lib/training/phases.ts)** — `PHASE_DEFINITIONS` (record par PhaseType : label, color, description, defaultRatio) + fonction `autoDistributePhases(startDate: string, raceDate: string): Phase[]`. Règles : Affûtage ≥ 2 semaines, Spécifique ≥ 3 semaines. Si prépa < 8 semaines → warning console. Si prépa > 20 semaines → insère Foncier 1 + récup intermédiaire + Foncier 2.

4. **[web/lib/training/session-templates.ts](web/lib/training/session-templates.ts)** — `SESSION_TEMPLATES: SessionTemplate[]` avec **≥ 3 templates par type** : sortie_longue (3), fractionne (3), seuil_tempo (3), cotes (3), course (2), runtaf (2), velotaf (1). Liste exacte dans la spec source.

5. **[web/lib/training/charge.ts](web/lib/training/charge.ts)** — Fonction `estimateCharge(durationMin: number, intensity: IntensityLevel, elevationM?: number): number`. Formule : `duration * intensityFactor[intensity] * (1 + elevation/1000 * 0.15)`. `intensityFactor = { 1: 0.5, 2: 0.8, 3: 1.2, 4: 1.8, 5: 2.5 }`.

6. **[web/lib/plan/storage.ts](web/lib/plan/storage.ts)** — Helpers `getRace()`, `saveRace()`, `getPlannedSessions(weekStart)`, `savePlannedSession()`, `deletePlannedSession()`, `getCurrentPlan()`, `saveCurrentPlan()`, `getCustomTemplates()`, `saveCustomTemplate()`. Pattern : tente Supabase via `createBrowserClient()` ; si user pas authentifié OU table absente (erreur "relation does not exist") → fallback localStorage avec clés `tc:plan:*:v1` listées dans la spec. **Important :** retourner des Promises pour rester uniforme.

7. **[web/__tests__/lib/training/phases.test.ts](web/__tests__/lib/training/phases.test.ts)** — Tests Jest pour `autoDistributePhases` : prépa 16 semaines (vérifier ratios), prépa courte 6 semaines (vérifier warning + distribution minimaliste), prépa longue 24 semaines (vérifier insertion Foncier 1/2).

8. **[web/__tests__/lib/training/charge.test.ts](web/__tests__/lib/training/charge.test.ts)** — Tests Jest pour `estimateCharge` : valeurs attendues pour quelques combinaisons (60min × intensité 3 sans D+, 90min × intensité 4 avec 500m D+, etc.).

**Acceptance :**
- Tous les imports `WorkoutType` cohérents avec l'existant.
- Migration SQL compile mentalement (les FK vers `auth.users` existent déjà dans Supabase).
- Tests Jest passent (`npm test`).
- `npm run lint` clean sur les nouveaux fichiers.
- Aucun fichier UI touché.

**Commit attendu :** `feat(plan): fondations data + types + lib métier`

---

## Task 2 — 3 blocs simples : Mode toggle + Objectif course + Charge planifiée

**Objectif :** livrer les 3 blocs les moins complexes pour avoir un squelette visible immédiatement.

**Fichiers à créer :**

1. **[web/components/plan/ModeToggleBlock.tsx](web/components/plan/ModeToggleBlock.tsx)**
   - Pill toggle 2 segments : `Manuel` (actif) | `IA Coach` (opacity ~50%, non cliquable, mini-pill `Bientôt` à droite).
   - Click sur segment IA Coach (même désactivé via overlay) → toast `Le coach IA arrive prochainement`. Utiliser le toast existant si présent (chercher `useToast` ou équivalent dans `web/components/ui/`), sinon `alert()`.
   - Wrapper standard `rounded-[12px] bg-trail-card border border-trail-border p-[10px]`.

2. **[web/components/plan/ObjectifCourseBlock.tsx](web/components/plan/ObjectifCourseBlock.tsx)**
   - Lit `race` via `getRace()` de `lib/plan/storage`.
   - État `race === null` : CTA centré `Définir mon objectif` + texte court "Ton objectif structure toute ta prépa."
   - État défini : Nom en Bebas Neue large, countdown **J-XX** géant (Bebas Neue), pills info distance (orange `colors.chargeOrange`), D+ (bleu `colors.seriesBlue`), type (cyan `colors.seriesCyan` ou équivalent), lieu (slate `trail-muted`). Bouton `Modifier` en haut à droite.
   - Calcul countdown : `Math.ceil((raceDate - now) / 86400000)`.
   - Modal édition → import dynamique de `RaceEditorModal`.

3. **[web/components/plan/RaceEditorModal.tsx](web/components/plan/RaceEditorModal.tsx)**
   - Modal via `createPortal(... document.body)`, fond noir 60% opacity, sheet bottom sur mobile.
   - Champs : Nom (text), Date (date input), Distance km (number), D+ m (number), Type (select trail/ultra/route/cross/skyrace avec labels FR), Lieu (text optional), Notes (textarea optional), toggle `Course principale`.
   - Boutons footer : Annuler | Supprimer (si édition) | Enregistrer.
   - À l'enregistrement : `saveRace()` + close + callback `onSaved`.

4. **[web/components/plan/ChargePlanifieeBlock.tsx](web/components/plan/ChargePlanifieeBlock.tsx)**
   - Mini bar chart 4 semaines glissantes (W-1, W0, W+1, W+2). Recharts ou SVG inline simple.
   - Chaque barre = somme `estimatedCharge` des `PlannedSession` de la semaine.
   - Couleur barre selon seuils : <100 vert, 100-200 jaune, 200-300 orange, 300-450 rouge, >450 violet (cf. `web/lib/analytics/charge-thresholds.ts`).
   - Ligne pointillée horizontale = `weeklyChargeTarget` de la phase courante (lue via `getCurrentPlan()`).
   - Badge warning si écart > 20% entre semaine courante planifiée et cible.

**Acceptance :**
- Les 3 blocs rendent sans erreur même si data vide.
- ObjectifCourseBlock affiche correctement countdown live.
- RaceEditorModal persiste correctement via storage helpers.
- ChargePlanifieeBlock fonctionne sans `planned_sessions` (affiche barres à 0).
- `npm run lint` clean.

**Commit attendu :** `feat(plan): blocs Mode toggle + Objectif course + Charge planifiée`

---

## Task 3 — Bloc Structure de Prépa + PhaseEditorModal

**Objectif :** le bloc central du mode coaching — timeline horizontale des mésocycles avec auto-distribution.

**Fichiers à créer :**

1. **[web/components/plan/StructurePrepaBlock.tsx](web/components/plan/StructurePrepaBlock.tsx)**
   - Header : `STRUCTURE DE PRÉPA` (Bebas Neue) à gauche + durée totale en semaines à droite + bouton wand `Régénérer` à l'extrême droite.
   - **Timeline horizontale composite** :
     - SVG ou divs en flex, chaque phase = segment coloré (couleur depuis `PHASE_DEFINITIONS[phase.type].color`).
     - Largeur segment proportionnelle à `(endDate - startDate)` rapportée au total.
     - Label phase + nombre de semaines DANS le segment si assez large (> 80px).
     - **Marqueur TODAY** : ligne verticale `colors.seriesCyan` ou `trail-primary` + chevron au-dessus.
     - **Marqueur RACE** : drapeau 🏁 à l'extrême droite.
   - Ticks dates clés (début phases) sous la timeline.
   - **Interaction** : click sur segment → expand vers le bas avec description (depuis `PHASE_DEFINITIONS[type].description`), `weeklyChargeTarget`, dates, bouton `Éditer` → ouvre PhaseEditorModal.
   - **États vides** :
     - Pas de course objectif (vérifie via `getRace()`) → message "Définis d'abord ton objectif".
     - Course définie mais 0 phases → CTA `Générer ma structure de prépa` → appelle `autoDistributePhases()` puis `saveCurrentPlan()`.

2. **[web/components/plan/PhaseEditorModal.tsx](web/components/plan/PhaseEditorModal.tsx)**
   - Modal via portal (pattern existant).
   - Bouton header `Auto-générer depuis ma course` (utilise `autoDistributePhases`).
   - Liste des phases avec drag handle (réutiliser pattern `useSortable` de BlockGrid).
   - Pour chaque phase éditable : Label (text), Type (select PhaseType FR), Dates start/end (date inputs), Charge hebdo cible (number), Description (textarea).
   - Bouton `+ Ajouter une phase`.
   - Footer : Annuler | Enregistrer (appel `saveCurrentPlan()`).

**Acceptance :**
- Click sur "Régénérer" → distribution automatique correcte.
- Click sur un segment → expand fluide avec data correcte.
- Marqueur TODAY positionné au bon endroit (proportionnel à `(now - startDate) / total`).
- Si course passée → marqueur TODAY après marqueur RACE (cas dégénéré, juste pas planter).

**Commit attendu :** `feat(plan): bloc Structure de Prépa + édition des phases`

---

## Task 4 — Vue Semaine + Bibliothèque + Modals séance/template + DnD séances

**Objectif :** la pièce maîtresse interactive — calendrier 7 jours + bibliothèque draggable + modals d'édition complets.

**Fichiers à créer :**

1. **[web/components/plan/PlanSessionsDndProvider.tsx](web/components/plan/PlanSessionsDndProvider.tsx)** — DnDContext partagé entre VueSemaine et Bibliothèque (séparé du DnD top-level de BlockGrid).
   - Types de draggable : `planned-session` (déplacement entre jours) et `session-template` (création depuis bibliothèque).
   - Drop targets : colonnes jour (id = `day-${ISO date}`).
   - Détection collision : `closestCenter`.
   - Au `onDragEnd`, dispatch selon `active.data.current.type`.

2. **[web/components/plan/VueSemaineBlock.tsx](web/components/plan/VueSemaineBlock.tsx)**
   - Header : nav `← Sem. précédente` | `SEMAINE X / Y — du XX au YY` | `Suivante →` ; pill phase courante (couleur de la phase) ; total semaine à droite (durée pill vert `colors.greenOk`, charge pill rouge `colors.seriesRed`, D+ pill bleu `colors.seriesBlue`).
   - Body : 7 colonnes Lun-Dim. **Scroll horizontal mobile** (`overflow-x-auto`), grille égale en desktop (`md:grid md:grid-cols-7`).
   - Header colonne : abréviation jour FR (`LUN`, `MAR`, `MER`, `JEU`, `VEN`, `SAM`, `DIM`) + numéro de date. Surlignage cyan si TODAY.
   - Corps colonne : drop zone (`useDroppable({ id: 'day-${iso}' })`). Mini-carte par PlannedSession (TypeIndicator + titre tronqué + durée + mini pill intensité).
   - Click sur séance → `SessionEditorModal` en édition.
   - Bouton `+` en bas colonne (jour vide ou non) → `SessionEditorModal` en création (date pré-remplie).
   - Footer : `Dupliquer la semaine` (copie toutes séances vers semaine suivante, +7j sur date) + `Enregistrer comme semaine type` (stub : juste console.log + toast "Bientôt").

3. **[web/components/plan/BibliothequeSeancesBlock.tsx](web/components/plan/BibliothequeSeancesBlock.tsx)**
   - Header : `BIBLIOTHÈQUE` (Bebas Neue) + filtres chips (Toutes, puis 7 chips icônes par type avec `<TypeIndicator />` réduit) + search input (filtre par titre/tags case-insensitive).
   - Body : grille responsive 2 col mobile / 3 col tablet / 4 col desktop. Chaque carte = `useDraggable({ id: 'template-${id}', data: { type: 'session-template', template } })`. TypeIndicator + titre Bebas Neue + ligne stats (durée min, distance km, D+ m) + intensité en mini-bar (5 carrés colorés).
   - Bouton `+ Nouveau template` → `TemplateEditorModal`.

4. **[web/components/plan/SessionEditorModal.tsx](web/components/plan/SessionEditorModal.tsx)**
   - Modal via portal, plein écran mobile.
   - Tabs internes : `Général` | `Structure` | `Notes`.
   - **Général** : Titre (text), Type (select WorkoutType avec TypeIndicator preview), Date (date input), Durée min (number), Distance km (number optional), D+ m (number optional), slider Intensité 1-5 avec labels FR (Récup / Endurance / Tempo / Seuil / VMA) et couleur par valeur, champ Charge estimée (auto via `estimateCharge`, éditable manuellement).
   - **Structure** : builder de TrainingZone[] avec drag handles. Boutons rapides `+ Échauffement`, `+ Bloc principal`, `+ Récup`, `+ Retour calme`. Pour bloc principal type série : champ `Répétitions ×`, durée, intensité, durée récup. Aperçu visuel barre composite intensité par zone (SVG simple, hauteur 30px).
   - **Notes** : textarea libre.
   - Footer : `Dupliquer` | `Supprimer` | `Annuler` | `Enregistrer` (appel `savePlannedSession()`).

5. **[web/components/plan/TemplateEditorModal.tsx](web/components/plan/TemplateEditorModal.tsx)**
   - Identique à SessionEditorModal **sans champ date** et **avec champ Tags** (multi-input chips).
   - Footer : `Dupliquer` | `Supprimer` (si édition) | `Annuler` | `Enregistrer` (appel `saveCustomTemplate()`).

**Acceptance :**
- Drag d'une séance entre 2 jours → date mise à jour, persistance OK.
- Drag d'un template depuis Bibliothèque sur un jour → nouvelle PlannedSession créée avec date du jour cible + defaults du template.
- Click sur séance → modal édition avec data pré-remplie.
- Click `+` colonne vide → modal création avec date pré-remplie.
- Filtres bibliothèque par type fonctionnels, search OK.
- Tabs SessionEditorModal switchent sans perte de state.
- Bouton dupliquer semaine → semaine suivante peuplée correctement.
- **Aucun croisement DnD** : pas moyen de drop un bloc Plan sur un jour (DnDContext séparés).

**Commit attendu :** `feat(plan): Vue Semaine + Bibliothèque + modals séance/template avec DnD`

---

## Task 5 — Intégration finale : PlanClient refactor + roadmap

**Objectif :** câbler tous les blocs dans PlanClient via BlockGrid, ajouter mocks de dev, créer doc roadmap.

**Fichiers à modifier/créer :**

1. **[web/app/(main)/plan/PlanClient.tsx](web/app/(main)/plan/PlanClient.tsx)** — Refactor complet.
   - Supprimer toute la sample data hard-codée (PLAN_WEEKS, PLAN_OBJECTIVES, etc.).
   - Supprimer les composants inline (PlanHeroCard, PlanCalendarCard, etc.).
   - Wrapper page : header avec titre (cohérent avec Cockpit/Charge) + `<BlockGrid storageKey="plan" defaultOrder={[...]} blocks={[...]} />`.
   - Ordre par défaut : `['mode', 'objectif', 'structure', 'semaine', 'bibliotheque', 'charge']`.
   - Wrapper `<PlanSessionsDndProvider>` autour des blocs `semaine` et `bibliotheque` (ou à plus haut niveau si simple).
   - `addLabel="Ajouter un bloc"`.

2. **[web/lib/plan/mock-data.ts](web/lib/plan/mock-data.ts)** — Données de dev (utilisable via flag NEXT_PUBLIC_PLAN_MOCK=1 ou en mode dev). Race Templiers + plan 4 phases auto-généré + 2 semaines de séances couvrant tous les types.

3. **[docs/plan-roadmap.md](docs/plan-roadmap.md)** — Roadmap des prochaines itérations :
   - Mode IA Coach (chat, génération auto, adaptation charge)
   - Sync Strava/Garmin pour séances planifiées vs réalisées
   - Notifications de rappel séance
   - Export PDF du plan
   - Partage avec coach humain
   - **Bonus reportés du MVP** : calcul charge avec elevation factor avancé, mini-graph profil intensité par zone, coaching tips dynamiques par phase, validation visuelle (alerte 2 hautes intensités enchainées), microcycle pattern 3:1, intégration calendrier Cockpit avec séances fantômes.

4. **[tasks/backlog.md](tasks/backlog.md)** — Ajouter une ligne par bonus reporté au format défini en bas du fichier.

**Acceptance :**
- `npm run build` passe.
- `npm run lint` clean.
- `npm test` passe.
- `npm run dev` lance la page Plan sans erreur, les 6 blocs s'affichent dans l'ordre par défaut, DnD top-level réordonne, persistance OK après reload.
- Aucune régression sur Cockpit et Charge (vérifier visuellement les pages).
- Doc `plan-roadmap.md` créée.

**Commit attendu :** `feat(plan): intégration PlanClient + doc roadmap`

---

## Final review checklist (post-Task 5)

- [ ] Toggle Manuel/IA Coach visible, IA désactivée + toast.
- [ ] 6 blocs s'affichent et respectent le design system.
- [ ] Réordonnancement blocs DnD + persistance.
- [ ] ObjectifCourseBlock CRUD course + countdown live.
- [ ] StructurePrepaBlock timeline avec phases, auto-génération, édition phase.
- [ ] VueSemaineBlock nav semaines, séances visibles, drag entre jours.
- [ ] BibliothequeSeancesBlock ≥ 3 templates par type, drag→calendrier crée séance.
- [ ] SessionEditorModal builder zones complet.
- [ ] ChargePlanifieeBlock 4 semaines colorées.
- [ ] Persistance Supabase (migration SQL fournie, Franck à appliquer manuellement) avec fallback localStorage.
- [ ] Aucune régression sur Cockpit/Charge.
- [ ] Responsive mobile testé.
- [ ] Tous labels FR cohérents.
