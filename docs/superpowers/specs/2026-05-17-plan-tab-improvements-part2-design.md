# Onglet Plan — Améliorations (suite, v2)

Spec d'implémentation pour la 2e vague d'améliorations de l'onglet Plan, basée sur le prompt `Prompts/plan-tab-improvements-part2-v2.md`. Couvre le formulaire « Nouvelle séance », la refonte des types d'activité (pills + modale Personnalisé), et l'enrichissement du tooltip Bibliothèque.

**Date :** 2026-05-17
**Branche cible :** `master` (3 PRs séparées découpées comme décrit en §6)
**Source du prompt :** `Prompts/plan-tab-improvements-part2-v2.md`

---

## 1. Contexte et inventaire de l'existant

Travail réalisé sur la branche `feat/plan-tab-manuel` (déjà mergée). Architecture actuelle :

- **Page Plan** : [PlanClient.tsx](web/app/(main)/plan/PlanClient.tsx) délègue à `<BlockGrid>` 7 blocs draggables. Le bloc « semaine + bibliothèque » est fusionné pour éviter la collision DnD top-level / interne.
- **Bibliothèque** : [BibliothequeSeancesBlock.tsx](web/components/plan/BibliothequeSeancesBlock.tsx). Pills horizontales scrollable (mobile) / flex-wrap (desktop), bouton « + Nouveau » à droite + pill équivalent en fin de barre.
- **Formulaire séance** : [SessionEditorModal.tsx](web/components/plan/SessionEditorModal.tsx) — modal portail, 3 tabs (Général / Structure / Notes). Modèle de zone : `{ kind, durationMin, intensity, label, repeats? }` stocké en JSONB côté Supabase (`planned_sessions.zones`, `session_templates.default_zones`).
- **Carte calendrier** : `<DraggableSessionCard>` dans [VueSemaineBlock.tsx#L386-L433](web/components/plan/VueSemaineBlock.tsx#L386-L433). Affiche type / titre / durée / badge intensité — **n'affiche pas `notes`** (bug Phase 1.7).
- **Schéma** : migrations [014_plan.sql](web/supabase/migrations/014_plan.sql) → [017_session_types_extension.sql](web/supabase/migrations/017_session_types_extension.sql). Types stockés en CHECK constraint, pas de table dédiée, pas de `is_visible` / `display_order`.
- **DnD** : `@dnd-kit` 6.3.1, long-press 250ms mobile, `touch-action: pan-y` sur cartes.
- **Tokens couleurs** : [colors.ts](web/lib/design/colors.ts) + CSS vars `--trail-*` ; thème sombre par défaut `#0A0F0E` bg / `#FF6B35` primary.

### Écarts entre le prompt et l'état actuel

| Phase prompt | État réel |
|--|--|
| 1.1 Retirer astérisque rouge sur Durée | ✅ Déjà conforme. Le champ Durée n'a ni `required` ni astérisque ([SessionEditorModal.tsx#L363](web/components/plan/SessionEditorModal.tsx#L363)). |
| 1.2 Supprimer le champ numérique RPE/Borg 11-15 | ✅ Pas d'objet. Ce champ n'existe pas — seul un slider 1-5 + badge intensité est présent. |
| 1.3 → 1.7, 2, 3 | Nouveau travail à implémenter. |

→ Les phases 1.1 et 1.2 ne génèrent **aucun code** ; on les laissera mentionnées dans la PR comme « no-op confirmé ».

---

## 2. Design — Phase 1 (Formulaire « Nouvelle séance »)

### 2.1 Auto-mapping Type → Intensité (Phase 1.3)

Table de mapping (helper pur, testable) dans [`web/lib/plan/type-intensity-map.ts`](web/lib/plan/type-intensity-map.ts) :

```ts
export const TYPE_DEFAULT_INTENSITY: Record<SessionType, IntensityLevel> = {
  fractionne:    5, // VMA
  seuil_tempo:   4, // Seuil
  cotes:         3, // Tempo
  footing:       2, // Endurance
  sortie_longue: 2,
  course:        2,
  runtaf:        2,
  velotaf:       2,
  velo:          2,
  natation:      2,
  renfo:         1, // Récupération
  musculation:   1,
}
```

Comportement dans `<GeneralTab>` :
- Au changement de Type, écraser `draft.intensity` avec la valeur par défaut.
- L'utilisateur peut override manuellement après ; un nouveau changement de Type écrase à nouveau (comportement simple).
- Pour les types custom (Phase 2), la valeur par défaut vient de `activity_types.default_intensity`.

### 2.2 Toggle Durée ↔ Distance par segment (Phase 1.4)

Extension rétro-compatible du type `Zone` ([web/types/plan.ts](web/types/plan.ts)) :

```ts
export type Zone = {
  kind: 'warmup' | 'main' | 'recovery' | 'cooldown' | 'repeat-step'
  mode?: 'duration' | 'distance'   // défaut 'duration' si absent
  durationMin?: number             // requis si mode = 'duration'
  distanceM?: number               // requis si mode = 'distance' (mètres)
  intensity: IntensityLevel
  intensityMode?: 'level' | 'pace' // défaut 'level' si absent
  paceSecPerKm?: number            // requis si intensityMode = 'pace'
  label?: string
  repeats?: number                 // niveau zone (existant)
}
```

UI dans `<SortableZoneRow>` :
- Toggle visuel `Durée / Distance` (segmented control 2 boutons) à côté du champ valeur.
- Si `mode = 'duration'` → affiche `<DurationField>` (existant, hh:mm).
- Si `mode = 'distance'` → affiche input numérique avec suffixe `m` / bascule `km` selon valeur (≥ 1000 m affiché en km).

Rétro-compatibilité : zones existantes sans `mode` interprétées comme `duration` ; le mapper [storage.ts](web/lib/plan/storage.ts) ne change pas (JSONB).

### 2.3 Toggle Intensité ↔ Allure par segment (Phase 1.5)

Mêmes principes que 2.2, sur la même ligne segment.

- Toggle visuel `Intensité / Allure`. **Allure par défaut uniquement pour les types running** : `intensityMode = 'pace'` à la création si le `type` de la séance est un type course-à-pied (`course`, `sortie_longue`, `fractionne`, `seuil_tempo`, `cotes`, `footing`, `runtaf`). Pour les autres types (vélo, natation, renfo, musculation, types custom non-running), `intensityMode = 'level'` par défaut. L'utilisateur peut bien sûr basculer manuellement.
- Input allure : composant nouveau [`web/components/plan/PaceField.tsx`](web/components/plan/PaceField.tsx) — masque `mm:ss /km`, `inputMode="numeric"`, parse vers `paceSecPerKm`.
- Si `intensityMode = 'level'` → dropdown 5 niveaux (existant simplifié à un select au lieu du slider à ce niveau granulaire).

Note UX : le slider 1-5 reste utilisé au niveau **séance globale** (champ Intensité du Général), seuls les segments switchent vers allure.

### 2.4 Container « Répéter » (Phase 1.6)

Nouveau type de zone `kind: 'repeat'` avec étapes imbriquées :

```ts
export type RepeatZone = {
  kind: 'repeat'
  repeats: number               // N fois
  skipLastRecovery?: boolean    // checkbox « Ignorer la dernière récupération »
  steps: RepeatStep[]
}

export type RepeatStep = {
  id: string                    // pour @dnd-kit
  label?: string                // auto-rempli ex: "Course à pied" / "Récupération"
  stepKind: 'effort' | 'recovery'
  mode: 'duration' | 'distance'
  durationMin?: number
  distanceM?: number
  intensityMode: 'level' | 'pace'
  intensity?: IntensityLevel
  paceSecPerKm?: number
}
```

Discrimination via `kind: 'repeat'` dans le tableau `zones[]` (le tableau accepte désormais `Zone | RepeatZone`).

**UI** ([`web/components/plan/RepeatZoneCard.tsx`](web/components/plan/RepeatZoneCard.tsx)) — dérivée du screenshot fourni, adaptée dark theme (`#0B0F1A` base / `--trail-surface` / `--trail-border`) :

- Header : grip drag `⋮⋮`, label « Répéter [input N] Fois », icône suppression.
- Liste DnD interne (`@dnd-kit/sortable`) des `RepeatStep[]`. Chaque étape :
  - Grip drag, libellé (auto-rempli selon `stepKind`), lien `Modifier étape` à droite, icône supprimer.
  - Aperçu sous le libellé : distance/durée + allure ou intensité (selon les modes).
  - Bordure colorée à gauche selon `intensity` (couleur `INTENSITY_LEVEL_COLORS[step.intensity]`).
- Bouton `+ Ajouter une étape` (ajoute une étape de type `recovery` si la précédente était `effort`, sinon `effort`).
- Checkbox `Ignorer la dernière récupération (?)` avec aide inline :
  > « Si activé, la séance se termine sur la dernière étape d'effort sans inclure la récupération finale. »
- **Pas** de mention « Appui sur touche Lap » du screenshot Garmin — on reste sur Durée / Distance.

**Édition d'étape** : ouvre un sous-modal `<RepeatStepEditor>` (au lieu d'éditer inline) — mêmes contrôles que `<SortableZoneRow>` (toggle durée/distance, toggle intensité/allure, libellé).

**Multi-containers** : plusieurs zones `kind: 'repeat'` possibles dans la même séance (pyramides : 1×400+1×800+1×1200+1×800+1×400 = 1 container de 5 étapes effort/récup, ou plusieurs containers avec un nombre de répétitions différent).

### Deux modes de modélisation offerts à l'athlète (cohabitation explicite)

L'athlète choisit, **lors de l'ajout d'un bloc principal**, entre deux modes via un sélecteur 2 boutons en haut de la liste de zones :

| Mode | Modélisation | Cas d'usage |
|--|--|--|
| **Bloc principal simple** | Zone normale (`kind: 'main'`) avec `repeats?: number` optionnel | « 1 zone tempo de 20 min », ou « 10 × 90s VMA sans récup formalisée » |
| **Bloc principal Répéter** | RepeatZone (`kind: 'repeat'`) avec `steps: RepeatStep[]` | « 10 × (400m VMA + 200m récup) » — récup explicite entre reps |

Les deux modes sont des choix produit délibérés, pas un mécanisme de rétro-compat. Le champ `repeats?: number` sur zone simple est **conservé** ; il s'affiche comme un compteur discret à droite du libellé de zone (existant — cf. [SessionEditorModal.tsx#L588-L593](web/components/plan/SessionEditorModal.tsx#L588-L593)). La distinction se fait via `kind` au moment du `switch` de rendu (`SortableZoneRow` pour `'main'`/`'warmup'`/etc., `RepeatZoneCard` pour `'repeat'`).

UI sur les boutons rapides d'ajout (Phase 1.6 modifie [StructureTab L. 468-479](web/components/plan/SessionEditorModal.tsx#L468-L479)) :

- `+ Échauffement`
- `+ Bloc principal` (simple)
- `+ Bloc Répéter` ← **nouveau**, ajoute une `RepeatZone` avec 2 étapes pré-remplies (1 effort + 1 récup)
- `+ Récup`
- `+ Retour calme`

### 2.5 Bug notes carte calendrier (Phase 1.7)

Diagnostic confirmé en Phase 0 :
- ✅ `notes` est persisté côté Supabase (`planned_sessions.notes text`, [014_plan.sql:64](web/supabase/migrations/014_plan.sql)).
- ✅ `notes` est lu/écrit par [`storage.ts`](web/lib/plan/storage.ts#L201-L259) (mapper `SessionRow ↔ PlannedSession`).
- ❌ `<DraggableSessionCard>` dans [VueSemaineBlock.tsx#L386-L433](web/components/plan/VueSemaineBlock.tsx#L386-L433) ne rend pas `session.notes`.

**Correctif** : afficher un extrait de notes (1 ligne, 60 chars max + ellipsis) sous le badge intensité dans la carte. Le texte complet reste accessible via le tap (qui ouvre déjà la modal d'édition).

```tsx
{session.notes && (
  <p className="mt-1 text-[11px] text-trail-muted line-clamp-1">
    {session.notes}
  </p>
)}
```

Test round-trip à valider en revue : création → save → re-load page → édition → re-save → l'extrait apparaît bien sur la carte semaine.

---

## 3. Design — Phase 2 (Types d'activité — pills + modale)

### 3.1 Modèle de données

Nouvelle migration [`web/supabase/migrations/018_activity_types.sql`](web/supabase/migrations/018_activity_types.sql) :

```sql
-- Table catalogue (types système + types custom user)
CREATE TABLE activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = système
  slug text NOT NULL,
  label text NOT NULL,
  default_intensity smallint NOT NULL CHECK (default_intensity BETWEEN 1 AND 5),
  category text, -- 'run' | 'bike' | 'swim' | 'other' (optionnel)
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, slug)
);

-- Préférences user (visibilité + ordre)
CREATE TABLE user_activity_prefs (
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_slug text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  display_order smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (athlete_id, activity_slug)
);

-- Seed des 9 types système (slugs alignés avec SessionType existant)
INSERT INTO activity_types (athlete_id, slug, label, default_intensity, category, is_system) VALUES
  (NULL, 'sortie_longue', 'Sortie longue', 2, 'run', true),
  (NULL, 'fractionne',    'Fractionné',    5, 'run', true),
  (NULL, 'seuil_tempo',   'Seuil',         4, 'run', true),
  (NULL, 'cotes',         'Côtes',         3, 'run', true),
  (NULL, 'footing',       'Footing',       2, 'run', true),
  (NULL, 'velo',          'Vélo',          2, 'bike', true),
  (NULL, 'natation',      'Natation',      2, 'swim', true),
  (NULL, 'renfo',         'Renfo',         1, 'other', true),
  (NULL, 'musculation',   'Musculation',   1, 'other', true);

-- RLS
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_types: read system + own" ON activity_types
  FOR SELECT USING (athlete_id IS NULL OR athlete_id = auth.uid());
CREATE POLICY "activity_types: insert own" ON activity_types
  FOR INSERT WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "activity_types: update own" ON activity_types
  FOR UPDATE USING (athlete_id = auth.uid());
CREATE POLICY "activity_types: delete own" ON activity_types
  FOR DELETE USING (athlete_id = auth.uid());

CREATE POLICY "user_activity_prefs: own" ON user_activity_prefs
  FOR ALL USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
```

**Décisions** :
- On garde le CHECK constraint actuel sur `planned_sessions.type` (les valeurs existantes ne bougent pas). On ajoutera plus tard une migration pour autoriser les slugs custom user — hors scope de cette spec (à backloguer).
- Pas de FK forte entre `planned_sessions.type` et `activity_types.slug` pour l'instant (pour ne pas casser l'historique). Validation côté app.
- Les 3 types runtaf, runtaf, course non listés dans le seed (présents dans `TYPE_OPTIONS` existant) → on les considère comme synonymes de footing/sortie_longue ; on les retire des pills par défaut côté UI (mais on garde dans le select Type pour les séances existantes).

⚠️ **Migration manuelle** : rappeler à Franck de la coller dans le Dashboard Supabase. Pas de FK forte pour éviter de bloquer le déploiement.

### 3.2 Modale « Personnaliser mes activités »

**Pill « Personnalisé »** unique en fin de barre (remplace l'actuel `+ Nouveau`/`+ Nouvelle activité`) — variant outline avec icône `⚙` discrète, taille identique aux autres pills. Cf. [BibliothequeSeancesBlock.tsx#L83-L99](web/components/plan/BibliothequeSeancesBlock.tsx#L83-L99).

**Composant** : [`web/components/plan/ActivityTypesPrefsModal.tsx`](web/components/plan/ActivityTypesPrefsModal.tsx). Modal portail (mêmes conventions visuelles que `<SessionEditorModal>`, dark theme).

**Contenu** :
- Liste DnD `@dnd-kit/sortable` des types disponibles (système + custom user).
- Chaque ligne : checkbox `is_visible`, label, grip drag `⋮⋮`, icône `🗑` (visible uniquement si `is_system = false`).
- Bouton `+ Ajouter une activité` → ouvre un mini-form inline (libellé texte libre + intensité par défaut 1-5 + catégorie optionnelle).
- Footer : Annuler / Enregistrer.

**Sauvegarde** :
- Bouton « Enregistrer » fait un upsert batch sur `user_activity_prefs` (un INSERT … ON CONFLICT DO UPDATE par slug).
- Création d'activité custom = INSERT dans `activity_types` (avec `athlete_id = auth.uid()`, `is_system = false`) + INSERT dans `user_activity_prefs`.
- Suppression custom = DELETE dans `activity_types` + DELETE des prefs.

**Hook** : [`web/lib/plan/use-activity-types.ts`](web/lib/plan/use-activity-types.ts) — fetch + cache des types visibles, exposés via React Context au bloc Bibliothèque.

**Initialisation** : si l'utilisateur n'a aucune ligne `user_activity_prefs`, on retourne tous les types système avec `is_visible = true` et `display_order` par ordre de seed.

### 3.3 Cohérence pills

- Plus de pill `+ Nouveau` séparé (déjà réfléchi : remplacé par le pill `⚙ Personnalisé`).
- Bouton `+ Nouveau` (template) reste accessible en haut-droite du bloc Bibliothèque uniquement.
- Pas d'icône sur les pills (alignement prompt principal).
- Pill `Personnalisé` : style outline pour le différencier (bordure 1px `--trail-border`, fond transparent), icône `⚙` 12px à gauche du label.

---

## 4. Design — Phase 3 (Tooltip Bibliothèque enrichi)

Modification de [BibliothequeSeancesBlock.tsx#L71-L73](web/components/plan/BibliothequeSeancesBlock.tsx#L71-L73) — les props `helpTitle` / `helpBody` de `<BlockCard>`.

**Nouveau contenu** (~75 mots, structuré en bullet) :

```md
**Ta bibliothèque personnelle** de séances, organisée par type d'activité.

- **Créer une séance** — bouton « + Nouveau » en haut → formulaire complet (type, durée, structure, notes).
- **Structure** — décomposer en segments : échauffement, blocs « Répéter » avec séries/récup, retour au calme.
- **Ajouter au calendrier** — appui long sur une séance puis glisser dans la semaine.
- **Personnaliser** — pill « Personnalisé » en fin de barre pour cocher/décocher ou ajouter des activités (Tennis, Yoga…).
```

`<BlockHelpSheet>` actuel ([BlockHelpSheet.tsx](web/components/blocks/BlockHelpSheet.tsx)) accepte uniquement `body: string` rendu en `<p>` plat avec `whitespace-pre-line`. **Action** : étendre la signature pour accepter `body: string | React.ReactNode` afin de passer du JSX riche (bullets, gras). Les autres usages de `BlockHelpSheet` continuent de passer une string — rétro-compatible.

---

## 5. Tests manuels (à documenter en PR)

- **Phase 1.3** : changer Type → vérifier que Intensité bascule. Modifier Intensité, changer à nouveau de Type → vérifier l'écrasement.
- **Phase 1.4 / 1.5** : créer un segment, basculer durée → distance, intensité → allure. Sauvegarder, recharger, vérifier la persistance.
- **Phase 1.6** : créer un container Répéter à 3 étapes (effort 1 km / récup 1 min / effort 500 m), N=4, cocher « Ignorer la dernière récupération ». Sauvegarder, recharger, éditer, ré-ordonner les étapes, vérifier la persistance.
- **Phase 1.7** : créer une séance avec notes, vérifier l'affichage sur la carte calendrier. Éditer les notes, vérifier le rafraîchissement.
- **Phase 2** : ouvrir modale Personnalisé, décocher Natation, ajouter Tennis (intensité 2), réordonner via drag, supprimer Tennis. Vérifier la persistance après reload.
- **Phase 3** : ouvrir le tooltip (i) du bloc Bibliothèque, vérifier le rendu.

---

## 6. Découpage en PRs

| PR | Périmètre | Migrations |
|--|--|--|
| **PR 1 — Formulaire séance** | Phases 1.3 (auto-mapping), 1.4 (toggle durée/distance), 1.5 (toggle intensité/allure), 1.6 (container Répéter), 1.7 (bug notes carte). Modifications types `Zone` rétro-compatibles, nouveaux composants `RepeatZoneCard`, `PaceField`, `RepeatStepEditor`. | Aucune migration SQL (JSONB rétro-compatible). |
| **PR 2 — Types d'activité (pills + modale)** | Phase 2 complète : migration `018_activity_types.sql`, modale `ActivityTypesPrefsModal`, refonte pills (suppression `+ Nouveau` pill, ajout `⚙ Personnalisé`), hook `useActivityTypes`. Branchement de l'auto-mapping Phase 1.3 sur le catalogue custom. | `018_activity_types.sql` (manuel Dashboard). |
| **PR 3 — Tooltip Bibliothèque** | Phase 3 uniquement. Petit changement de texte + éventuel support markdown dans `BlockHelpSheet`. | Aucune. |

Ordre suggéré d'implémentation : PR 1 → PR 2 → PR 3. PR 2 dépend de PR 1 pour le branchement de l'auto-mapping sur les types custom (sinon on hardcode `TYPE_DEFAULT_INTENSITY` en PR 1 et on le remplace par un lookup en PR 2 — c'est ce qu'on fait).

---

## 7. Hors scope (à backloguer si besoin)

- Refonte calendrier (déjà couvert par le prompt principal).
- Partage de bibliothèque inter-utilisateurs.
- Coach IA (les emplacements existants restent).
- Import/export de séances.
- Concept « Appui touche Lap » Garmin.
- FK forte `planned_sessions.type` → `activity_types.slug` (impactera la migration des séances historiques).
<!-- migration des repeats simples retirée — cohabitation explicite des deux modes est une décision produit, pas une transition -->

---

## 8. Risques

- **Rétro-compatibilité JSONB zones** : les séances existantes sans `mode`/`intensityMode` doivent rester chargeables. Tests d'intégration à ajouter sur le mapper [`storage.ts`](web/lib/plan/storage.ts).
- **RLS sur `activity_types`** : un user ne doit jamais voir les types custom d'un autre. Le SELECT policy `athlete_id IS NULL OR athlete_id = auth.uid()` couvre, à valider en revue.
- **DnD imbriqué (étapes de Repeat)** : un nouveau `DndContext` dans le sous-modal `<RepeatStepEditor>` — pas de conflit puisqu'il vit dans un portal séparé. À vérifier en test manuel touch mobile.
- **Performances pills** : avec types custom user, la liste peut grossir ; on garde scroll horizontal, pas de virtualisation.

---

## 9. Décisions architecturales

- **Modèle activity_types séparé en table dédiée** (vs. JSONB dans `profiles`) : retenu pour requêtabilité et scalabilité, plus propre à terme.
- **Extension du modèle `Zone` rétro-compatible** (vs. refonte propre) : retenu pour éviter une migration JSONB risquée sur l'historique.
- **Cohabitation explicite « Bloc principal simple » vs « Bloc principal Répéter »** : choix produit délibéré (pas un legacy à migrer). Les deux modèles servent des cas d'usage différents — répétition sans récup vs avec récup explicite.
- **3 PRs séparées** (vs. PR globale ou 5 PRs fines) : retenu pour aligner sur la préférence « petites éditions ciblées » de Franck tout en gardant une cohérence fonctionnelle par PR.
