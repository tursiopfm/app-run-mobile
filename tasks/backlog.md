# Backlog

> Source unique des travaux différés Trail Cockpit.
> Mise à jour : 2026-05-14 (consolidation depuis IDEES_ET_MISES_A_JOUR.md + TODO V2).

## Priorité haute

### Tests composants activité — wrap I18nProvider manquant
- **Quoi** : `__tests__/activities/ActivitySplits.test.tsx` et `ActivityHeartRateZones.test.tsx` rendent leur composant sans `<I18nProvider>`, donc `useT()` throw `useI18n must be used inside <I18nProvider>` → 2 suites rouges. Fix = wrapper avec `<I18nProvider initialLang="fr">` (cf. `ActivityFractionneSplits.test.tsx`).
- **Pourquoi** : suite de tests `__tests__/activities/` rouge en permanence, masque de vraies régressions.
- **Identifié** : 2026-06-03

### Coach IA fonctionnel
- **Quoi** : remplacer le skeleton actuel par un vrai assistant (OpenAI ou Claude) qui lit `coach_messages` (Supabase) et propose des séances en fonction de la fatigue/objectifs.
- **Pourquoi** : sortir l'onglet Coach du mode "placeholder" et donner de la valeur réelle.
- **Identifié** : 2026-05-04

### Domaine personnalisé
- **Quoi** : pointer un nom de domaine (trailcockpit.app ou équivalent) sur le déploiement Vercel.
- **Pourquoi** : crédibilité + meilleure expérience PWA (icône d'installation iOS, partage).
- **Identifié** : 2026-05-04

### Cron jobs serveur
- **Quoi** : ajouter sync de sécurité quotidien (rattrape les webhooks ratés), recalcul métriques périodique, résumé hebdo.
- **Pourquoi** : robustifier le pipeline Strava → Supabase et préparer le coach.
- **Identifié** : 2026-05-04. Note : un cron `cron/strava-import` existe déjà pour l'import initial.

## Priorité moyenne

### Migrer le profil FC (zones cardiaques) vers Supabase
- **Quoi** : actuellement stocké en `localStorage` (clés `tc_athlete_hr` et `tc_hr_zone_method`).
- **Problème** : le profil ne suit pas l'utilisateur entre appareils. En local dev, profil vide → l'intensité s'affiche "Non mesurée" pour toutes les activités même avec `avg_hr` en base.
- **À faire** :
  1. Créer table `athlete_profile` (ou colonnes dans `profiles`) : `hr_zone_method`, `max_hr`, `resting_hr`, `aerobic_threshold_hr`, `threshold_hr`, `birth_year`, `custom_zones` (jsonb).
  2. Côté client, lire/écrire ce profil via Supabase plutôt que localStorage.
  3. Migration douce : au premier load, si profil DB vide mais localStorage rempli → push vers Supabase puis purge localStorage.
- **Identifié** : 2026-05-13

### SP-2 — upgrade auto du CES des nouvelles activités vers le modèle streams
- **Quoi** : le modèle CES SP-2 (GAP-IF, K_cardio, descente) ne s'applique qu'au **recalcul** (`recalculateUserEffortScores`, qui lit les streams stockés). Le backfill streams (`streams-backfill.ts`) écrit les métriques mais **ne recalcule pas le CES** ; une nouvelle activité (import/webhook) reçoit le CES scalaire et ne passe en SP-2 qu'au prochain recalcul manuel. → prévoir un déclenchement automatique : recalcul ciblé de l'activité juste après backfill de ses streams (ou recalcul périodique des users impactés).
- **Pourquoi** : sinon SP-2 reste dormant sur les nouvelles activités jusqu'à un recalcul manuel ; le CES affiché ne reflète pas le modèle pour les sorties récentes non encore recalculées.
- **À faire** : soit `streams-backfill` appelle `recalculateUserEffortScores`/`recalculateUserFatigue` pour les users dont une activité vient d'être backfillée, soit un recalcul ciblé par activity_id (plus léger qu'un recalcul user complet).
- **Identifié** : 2026-06-04 (review finale SP-2)

### Détail activité — STATS
- [ ] Retirer le bloc CES de l'onglet STATS

### Header — page Profil
- [ ] Vérifier que le lien ⋮ du header pointe bien vers `/profile` (et plus `/settings`)

### Cockpit — Semaine en cours
- [ ] Changer la sélection par défaut ALL → RUN
- [ ] Redesign 7 cartes de jours horizontales
  - Actif = fond orange + km en orange + D+ en bleu
  - Repos = transparent
  - Total : km orange · D+ bleu · Durée en vert

### Cockpit — Historique
- [ ] Vue "An" : afficher D+ par mois (parité Sem./Mois)

### Activités — Liste
- [ ] Popup intensité : retirer emoji début de ligne (redondant avec label)

### Carte Goals
- [ ] Vérifier que "Distance hebdo" est bien renommé "Km semaine" et "Distance annuelle" en "Km année"

### Tests composants i18n — wrapper I18nProvider manquant
- **Quoi** : ~57 tests Jest échouent avec `useI18n must be used inside <I18nProvider>` (ex. `AccountSection`, `PaceField`…). Ces tests rendent des composants qui appellent `useT()` sans wrapper `<I18nProvider initialLang="fr">`. Ajouter un helper de rendu partagé (`renderWithI18n`) et l'utiliser dans ces suites.
- **Pourquoi** : suite Jest rouge de base → masque les régressions réelles, rend le `npm test` peu fiable comme garde-fou.
- **Identifié** : 2026-06-01 (découvert pendant la feature onboarding Strava)

## Priorité basse

### Détail activité
- [ ] Centrer emoji intensité juste sous la valeur d'effort (pas en bas de carte)
- [ ] Poignée carte : fond glassmorphism plus visible
- [ ] Agrandir hauteur initiale de la carte (titre + date dessous)

### Navigation
- [ ] Conserver le panel recherche ouvert au retour depuis une activité

### PWA
- [ ] Splash screen PWA (post-domaine personnalisé)

## Onglet Plan — bibliothèque de séances

- [ ] Types de séance custom par utilisateur (table dédiée `user_session_types`) — Plan bibliothèque

### Pill "⚙ Personnalisé" — sémantique role
- **Quoi** : la pill outline `⚙ Personnalisé` dans `BibliothequeSeancesBlock` hérite de `<FilterPill>` qui pose `role="tab"` + `aria-selected`. Or cette pill n'est pas un filtre — elle ouvre une modal. Ajouter une variante `role="button"` pour ce cas.
- **Pourquoi** : a11y propre (lecture d'écran annonce "tab non sélectionné" pour un bouton qui n'est pas un tab).
- **Identifié** : 2026-05-17 (suite à PR2 plan-tab-improvements)

### Migration prefs LS → Supabase au login
- **Quoi** : si un user non-authentifié configure ses prefs/types en LS puis se connecte, les prefs LS sont ignorées par `getUserActivityPrefs()` et `getActivityTypes()` (Supabase retourne `[]`). Au premier login authentifié, faire un push des LS vers Supabase puis vider les LS.
- **Pourquoi** : éviter de perdre la config faite en mode anonyme.
- **Identifié** : 2026-05-17 (suite à PR2 plan-tab-improvements)

### SEED_OFFSET dupliqué entre helper et modal
- **Quoi** : `web/lib/plan/apply-activity-prefs.ts` exporte `SEED_OFFSET = 1000` ; le `buildInitialDrafts` interne du modal `ActivityTypesPrefsModal.tsx` réimplémente la même logique avec `1000 + idx` inline. Importer la constante pour éviter la dérive.
- **Pourquoi** : single source of truth pour l'ordre de fallback.
- **Identifié** : 2026-05-17 (suite à PR2 plan-tab-improvements)

## Onglet Plan — bonus reportés du MVP Mode Manuel

> Détail complet et contexte : `docs/plan-roadmap.md` (section "Bonus reportés").

### Calcul charge avec elevation factor avancé
- **Quoi** : moduler le facteur D+ de `lib/training/charge.ts` selon technicité terrain + prise en compte des descentes (casse musculaire).
- **Pourquoi** : la formule actuelle (`1 + elevation/1000 * 0.15`) sous-estime les sorties techniques et ignore l'impact des descentes.
- **Identifié** : 2026-05-16

### Mini-graph profil intensité par zone (carte PlannedSession)
- **Quoi** : mini-bar SVG (~30 px) dans la carte journalière de `VueSemaineBlock` représentant la séquence `TrainingZone[]` colorée par intensité (style Strava).
- **Pourquoi** : lecture instantanée de la structure de séance sans ouvrir le modal.
- **Identifié** : 2026-05-16

### Coaching tips dynamiques par phase
- **Quoi** : encart info dans `StructurePrepaBlock` changeant selon la phase courante (tip actionnable ~2 phrases) basé sur `PHASE_DEFINITIONS`.
- **Pourquoi** : rapprocher l'app du coaching humain en donnant le "pourquoi" de chaque phase.
- **Identifié** : 2026-05-16

### Validation visuelle (alerte 2 hautes intensités enchaînées)
- **Quoi** : dans `VueSemaineBlock`, signaler (⚠️ + tooltip) toute paire de séances `intensity ≥ 4` sur 2 jours consécutifs.
- **Pourquoi** : éviter les erreurs classiques de planification que l'app peut détecter de façon déterministe.
- **Identifié** : 2026-05-16

### Microcycle pattern 3:1 auto
- **Quoi** : bouton "Appliquer 3:1" dans `PhaseEditorModal` (3 sem progressives +5/+10/+15 % puis 1 sem -30 %).
- **Pourquoi** : pattern classique d'entraînement, automatisable sans IA.
- **Identifié** : 2026-05-16

### Intégration calendrier Cockpit avec séances fantômes
- **Quoi** : afficher les `PlannedSession` à venir en pointillé 60 % opacity à côté des `Activity` réalisées dans `WeekBlock` / `WeekActivitiesBlock` ; matching via `linkedActivityId`.
- **Pourquoi** : voir d'un coup d'œil planifié vs réalisé dans le bloc Cockpit, pas seulement dans Plan. Brique commune avec la Vague 2 "intégrations Strava/Garmin" du roadmap Plan.
- **Identifié** : 2026-05-16

## Cycles v2 — sub-projects à venir (suite de la Fondation A)

> Sub-project A (Fondation : migration 022 + types + moteur de génération) livré le 2026-05-20.
> Spec : `docs/superpowers/specs/2026-05-20-cycles-v2-foundation-design.md`.

### Sub-project B — Cycles v2 timeline UI ✅ Livré 2026-05-20
- **Quoi** : refonte timeline horizontale multi-macros + courses A/B/C avec stacking, sélecteur de macrocycle actif.
- **Pourquoi** : visualiser plusieurs macrocycles simultanés (un par course objectif) et leurs priorités, là où l'UI actuelle n'expose qu'un plan unique.
- **Identifié** : 2026-05-20
- **Livré** : MacrocycleSelectorCard + bottom sheet, NewMacrocycleModal, RaceMarkers (A/B/C + stacking), StructurePrepaBlock refondu props-driven avec expand read-only et focus visible.

### Sub-project C — Cycles v2 édition UI ⛔ Supersédé 2026-05-22
- **Quoi** : refonte `StructurePrepaBlock` en accordéon (macro > meso > semaines) + warnings pédagogiques (taper manquant avant A, montée brutale).
- **Pourquoi** : permettre l'édition fine des nouveaux objets persistés (mésocycles, semaines avec `is_manual_override`) et guider l'utilisateur sur les erreurs classiques.
- **Identifié** : 2026-05-20
- **Livré puis supersédé** : trop complexe pour l'utilisateur lambda. Module retiré via `chore/cycles-simplify` le 2026-05-22 — édition simplifiée à nom/type/dates/focus/charge + tableau km/D+ par semaine. Le moteur warnings/loadPattern/weekType est conservé en historique git pour la phase Coach IA future.

### Sub-project D — Cycles v2 templates de prépa ⛔ Supersédé 2026-05-22
- **Quoi** : modale "Créer depuis course objectif" avec presets ultra / trail_court / reprise / personnalisé.
- **Pourquoi** : accélérer la création d'un macrocycle complet à partir d'une course en base et d'un template adapté à la distance / au profil.
- **Identifié** : 2026-05-20
- **Livré puis supersédé** : trop complexe en V1. Module retiré via `chore/cycles-simplify` le 2026-05-22. Les recipes (ultra 6/5/6/2/2, trail court 4/4/3/3/1, reprise 2/6/4) sont gardées dans l'historique git pour réutilisation par le Coach IA.

## À qualifier (ni planifié ni écarté)

- [ ] Authentification Strava avec plusieurs clients API
- [ ] Suppression de compte utilisateur (RGPD auto-service)
- [ ] Politique de confidentialité
- [ ] Import FIT / GPX / TCX manuel
- [ ] Connexion Garmin / Polar / Suunto
- [ ] Module "Entraînement" pour planifier vis-à-vis d'une course (vue planning hebdo/mensuel)
- [ ] Coach IA — proposer des entraînements selon fatigue et objectifs (sous-tâche de Coach IA prioritaire)

## Android (legacy, focus depuis 2026-05-04 = web)

- [ ] Maintenir parité avec web si besoin
- [ ] Suffer score propriétaire (fonctionnement sans abonnement Strava)
- [ ] Page profil athlète équivalente au web

---

## Notes opérationnelles

### Strava OAuth — multi-environnement
Le web app et le backend mobile partagent le même `client_id=228003` mais ont des `redirect_uri` différents. Strava n'accepte qu'un seul callback domain à la fois → switcher selon ce qu'on teste :

- Web app local → `localhost`
- App mobile → `excess-deceiver-throwback.ngrok-free.dev`
- Vercel prod → `trailcockpit.run`

Commandes :
```
C:\Users\Franc\app-run-mobile\backend\strava-oauth> npm run dev
C:\Users\Franc\app-run-mobile\web> npm run dev
```

### Plan/bibliothèque — durcissement post-refonte
- **Quoi** : suite à la refonte 2026-05-27 de `SESSION_TEMPLATES` (50 séances), plusieurs items à durcir :
  1. Hide le pill "Musculation" du FilterBar quand 0 template système (les muscu sont fusionnées dans renfo) — sauf si l'user a des templates custom de type 'musculation'.
  2. Deep-clone défensif de `template.defaultZones` à `PlanClient.tsx:126` et `SessionEditorModal.tsx:127` (actuellement assigné par référence — latent footgun si un futur éditeur fait du mutate in-place).
  3. Resserrer les signatures `effortStep`/`recoveryStep` en discriminated union pour que TypeScript exige `durationMin` ou `distanceM` à la compilation.
  4. Choisir une durée par défaut stable pour `cr-cible` (actuellement 240min/4h — arbitraire).
- **Pourquoi** : finitions remontées en review finale, non-bloquantes pour le PR.
- **Identifié** : 2026-05-27

---

## Modèle de fiche pour un nouvel item

```md
### Titre
- **Quoi** : description courte
- **Pourquoi** : valeur / motivation
- **À faire** (optionnel) : étapes
- **Identifié** : YYYY-MM-DD
```
