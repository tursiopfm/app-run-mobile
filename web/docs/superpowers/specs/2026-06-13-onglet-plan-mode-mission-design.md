# Onglet Plan (Mode Mission) — refonte « feuille de route tournée vers l'avant »

> **Status: Spec** · 2026-06-13 · Maquettes : `Prompts/plan-tab-mission-final-mockup.html` (mix retenu) + `Prompts/plan-tab-mission-redesign-mockups.html` (3 directions explorées)

## Problème

L'onglet Plan du Mode Mission ([web/components/mission/MissionPlan.tsx](../../../components/mission/MissionPlan.tsx)) n'est pas abouti. Quatre manques :

1. **« Ajouter une course » mal routé.** L'état vide de la Destination pointe sur `/plan?full=1`, qui rend le **Plan expert complet** au lieu d'ouvrir la création de course.
2. **Bloc « Ma prépa » non pertinent sans course.** Il ne s'affiche que si un macrocycle existe (`{plan && week && …}`) ; sinon, soit rien, soit un plan résiduel (« Semaine 1/3 · Affûtage · 0/0 »). Aucun contenu pour l'athlète **sans plan structuré**.
3. **Bloc « Ma semaine » incomplet.** Il ne lit que les `PlannedSession` planifiées : pas de saisie possible, et **le réalisé (activités run/vélo/nat) n'est pas affiché**. La donnée existe pourtant (le Cockpit l'affiche déjà via `SessionsSemaineCard`).
4. **Pas de suggestion de séances.** Rien ne propose les prochaines séances en fonction du réalisé, de la fatigue et de l'objectif course.

## Décisions (validées avec Franck)

- **Moteur de suggestion = règles déterministes, pas d'IA**, pour démarrer. Le module Coach IA viendra plus tard, comme **couche d'habillage** au-dessus du moteur (le bouton « Affiner avec le coach » reste un placeholder `Bientôt`). Justification : on réutilise le modèle de charge/fraîcheur déjà au cœur de l'app → suggestions **explicables, gratuites, offline, sûres**, et non bloquées par la construction du module IA.
- **« Ma semaine » fusionne réalisé + planifié/suggéré**, avec saisie manuelle.
- **Zéro jargon « TSB »** dans l'onglet Plan : on parle de « fraîcheur », « fatigue normale », etc. — vocabulaire déjà produit par `formeVerdict()` / `M.formeVerdict[zone]`.
- **Le Plan reste tourné vers l'avant** (« quoi faire ensuite »), pour ne pas dupliquer le Cockpit qui possède déjà « État de forme », « Ma semaine + volume » et « Cap de la semaine ».

## Layout retenu (mix A+B+C)

Ordre des blocs, de haut en bas :

1. **Héros « Ta prochaine séance »** (repris de la maquette B) — la séance suggérée du jour en grand, avec :
   - titre, durée · distance, intensité (`●●●○`) ;
   - encart **« Pourquoi cette séance »** : 2–3 puces générées par le moteur de règles (fraîcheur, charge récente, phase/J-X) ;
   - actions **Je l'ai faite · Décaler · Autre**.
2. **« Ma semaine »** (repris de A) — fil unifié lundi→dimanche :
   - jours passés = **réalisé** (auto-import Strava, pastille couleur sport, km · D+ · durée, ✓) ;
   - aujourd'hui = surligné ;
   - jours à venir = **planifié/suggéré** avec mini-puce *pourquoi* (`récup`, `+18 km cible`, `aérobie`…) ;
   - ligne fantôme **« ＋ Ajouter une séance »**.
3. **« Destination · Semaine X/Y »** (repris de C) — carte compacte : `J-X`, nom de course, **frise de phases** Base/Spécifique/Affûtage avec curseur ; tap → tableau de course. **État vide** (pas de course) → voir §Bloc générique.
4. **Bouton « Affiner avec le coach »** — désactivé, badge `Bientôt`, suivi de la navbar.

### États du héros (bloc 1)

- **Séance suggérée** (défaut) — teinte primaire/discipline + encart pourquoi + actions.
- **Séance du jour déjà réalisée** — teinte verte « faite ✓ », affiche le réalisé (km · D+ · durée), message de récup.
- **Repos suggéré** — teinte neutre/bleutée « Récupération », raison (« 2 grosses séances cette semaine »).
- La teinte du héros suit la **discipline** de la séance (run = primaire, vélo = `--data-bike`, natation = `--data-swim`), comme aujourd'hui (`sessionAccent`).

## Moteur de règles (`lib/mission/session-advisor.ts`, nouveau)

Fonction pure, **déterministe**, testable isolément. Pas d'appel réseau.

**Entrées :**
- `freshness` : `computeFreshness(payload.dailyMetrics)` → `zone` (+ `formeVerdict(zone)` pour le verdict humain). **On n'expose jamais le nombre TSB dans l'UI Plan.**
- `weekDone` : volume / D+ / nb séances déjà réalisés cette semaine (depuis `weekActivities`), et types des séances récentes (facile vs qualité).
- `target` : cible hebdo km/D+ (`resolveMissionWeeklyTarget`) — si pas de plan, cible = **rythme habituel** = moyenne km/D+ des semaines des **28 derniers jours** d'activités (la série de charge `DailyLoad` ne porte que le CES, pas les km → on agrège depuis les lignes d'activité).
- `phase` : phase courante + `J-X` (`computePhaseSegments` / `weekOfPlan`) — `null` si pas de course.
- `plannedWeek` : `PlannedSession[]` de la semaine (un plan explicite **prime** sur la suggestion).

**Sorties :** pour chaque jour restant de la semaine, soit une `SuggestedSession` (type, durée/distance/intensité cibles, libellé, **`reason`** = la puce *pourquoi*), soit `rest`. Le « jour » (héros) = la suggestion du premier jour pertinent.

**Règles (principes, non arbitraires) :**
- **Fraîcheur** : zone « fatigué » → easy/repos ; zone normale/fraîche → qualité autorisée ; affûté + course proche → maintien/spécifique.
- **Polarisation** : viser ~80 % facile / 20 % qualité sur la semaine ; ne pas enchaîner 2 séances dures → si qualité déjà faite récemment, proposer easy.
- **Cible hebdo** : répartir le **reste à faire** (km/D+) sur les jours restants ; le week-end accueille la sortie longue.
- **Phase** (si course) : Base → volume + SL ; Spécifique → qualité au profil de la course ; Affûtage → volume réduit, fraîcheur.
- **Sans course** : pas de phase ; cible = rythme habituel ; puces génériques (`aérobie`, `qualité`, `récup`).
- **Plan explicite prioritaire** : si l'athlète a déjà planifié la journée, on l'affiche tel quel (le moteur ne remplit que les trous).

Le wording des `reason` réutilise le vocabulaire de fraîcheur existant (`M.formeVerdict`), jamais « TSB ».

## Fusion réalisé ↔ suggéré (`lib/mission/week-feed.ts`, nouveau)

Construit le modèle du bloc « Ma semaine » : 7 entrées (lun→dim). Pour chaque jour :
- activité(s) réalisée(s) ce jour (depuis `weekActivities`, clé date `start_time.slice(0,10)`) ;
- séance planifiée ce jour (`PlannedSession`) ;
- sinon suggestion du moteur.
Matching réalisé↔planifié : **par date** (réutilise la logique de `lib/plan/session-matching.ts`) → si une activité réalisée correspond à une séance planifiée le même jour, on affiche le réalisé avec ✓.

## Comportements

- **« ＋ Ajouter une séance »** → `SessionAddSheet` (choisir un template ou « créer vierge ») → `SessionEditorModal`, `initialDate` = aujourd'hui. **Même flux que le mode expert**, aucun nouvel éditeur.
- **Héros · Je l'ai faite** → marque la `PlannedSession` `completed` (utile avant rattachement Strava, ou séance non trackée).
- **Héros · Décaler** → déplace la séance suggérée/planifiée à un autre jour de la semaine (réutilise `savePlannedSession` avec nouvelle date, comme `handleMoveSession`).
- **Héros · Autre** → ouvre `SessionAddSheet` pour choisir un autre type/template.
- **Destination · tap** → `/plan/courses/{id}` (inchangé).

## Correctif routage « Ajouter une course »

Aujourd'hui : CTA état vide → `/plan?full=1` → Plan expert. Cible : **ouvrir directement le formulaire de création** (`RaceEditorModal`, déjà utilisé par `ObjectifCourseBlock`, supporte l'auto-remplissage URL livré récemment).

Option retenue : **deep-link `/plan?full=1&new=1`** + `ObjectifCourseBlock` auto-ouvre `RaceEditorModal` (création) quand `searchParams.new === '1'`. Avantage : l'athlète atterrit dans le contexte « courses » (cohérent après création il voit sa liste), sans réécrire le modal hors de son bloc. Le même CTA est partagé par : la Destination vide **et** le bloc générique « Ton rythme ».

> Alternative écartée : monter `RaceEditorModal` directement dans `MissionPlan`. Plus de duplication d'état (le modal gère déjà reload + écran « course créée » dans `ObjectifCourseBlock`).

## Bloc générique sans course (remplace « Ma prépa »)

Quand aucune course à venir : la carte Destination passe en **état vide** (« Aucune course prévue » + CTA création) et le bloc « Ma prépa » est remplacé par **« Ton rythme · 4 dernières semaines »** :
- mini-barres du volume hebdo km (4 dernières semaines, dernière en primaire), agrégées depuis les **lignes d'activité des 28 derniers jours** ;
- libellé « ≈ X km/sem sur 1 mois. Continue — ou fixe un objectif pour structurer ta prépa. » ;
- CTA « 🎯 Choisir une course objectif » → même deep-link de création.

Le moteur de règles **fonctionne quand même** dans ce mode (cible = rythme habituel, puces génériques) : l'athlète sans plan voit malgré tout son réalisé + des suggestions cohérentes.

## Données / câblage page

`MissionPlan` est aujourd'hui un composant client autonome. Il lui manque `weekActivities` (réalisé) et `freshnessPayload` (fraîcheur), tous deux **déjà calculés côté serveur** pour le Cockpit ([web/app/(main)/dashboard/page.tsx](../../../app/(main)/dashboard/page.tsx)).

Décision : **`web/app/(main)/plan/page.tsx`** (server, mode Mission) récupère `freshnessPayload` (`getChargePageData`, repli run→all comme le dashboard) + **les lignes d'activité des 28 derniers jours** (`recentActivities`, mêmes champs `ACTIVITY_CARD_FIELDS`) + `discipline`, et les passe en props à `MissionPlan`. La semaine courante est un **filtre** de `recentActivities` (pas de 2e requête). Les `PlannedSession` / macrocycle restent chargés côté client (storage). Cohérent avec le coût du Cockpit en mode Mission (qui charge déjà `getChargePageData`).

## i18n

Nouvelles clés sous `mission` (dictionnaire `fr.ts`) : titres/labels du héros, puces *pourquoi* paramétrées, libellés « Ton rythme », actions. **Interdiction du terme « TSB »** dans toutes les chaînes de l'onglet Plan.

## Fichiers touchés (estimation)

| Fichier | Action |
|---|---|
| `lib/mission/session-advisor.ts` | **nouveau** — moteur de règles (pur) |
| `lib/mission/week-feed.ts` | **nouveau** — fusion réalisé+planifié+suggéré |
| `components/mission/MissionPlan.tsx` | refonte layout (héros, fil semaine, destination compacte) |
| `components/mission/PlanHeroCard.tsx` | **nouveau** — héros + états + actions |
| `components/mission/RythmeCard.tsx` | **nouveau** — bloc générique sans course |
| `app/(main)/plan/page.tsx` | passer `weekActivities` + `freshnessPayload` à `MissionPlan` |
| `components/plan/ObjectifCourseBlock.tsx` | auto-ouvrir création si `?new=1` |
| `lib/i18n/dictionaries/fr.ts` | clés `mission` (sans « TSB ») |
| réutilisés tels quels | `SessionAddSheet`, `SessionEditorModal`, `RaceEditorModal`, `computeFreshness`, `formeVerdict`, `resolveMissionWeeklyTarget`, `computePhaseSegments`, `session-matching` |

**Pas de migration Supabase** (on lit des données existantes).

## Tests

- `session-advisor` : tests unitaires sur cas représentatifs (fatigué→easy ; qualité déjà faite→easy ; cible non atteinte→SL le week-end ; sans course→générique ; plan explicite prioritaire).
- `week-feed` : fusion réalisé/planifié, matching par date, jours vides.
- `MissionPlan` : rend le héros selon l'état (suggéré / fait / repos) ; bloc générique quand pas de course ; CTA création route avec `?new=1`.
- Suites Jest ciblées uniquement (cf. faux positifs i18n pré-existants).

## Hors périmètre

- **Module Coach IA** (le bouton reste `Bientôt`).
- Refonte du Plan **expert** (inchangé).
- Édition avancée des phases de prépa depuis le Mode Mission.
