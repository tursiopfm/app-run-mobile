# Roadmap — Onglet Plan

> Contexte : le **Mode Manuel** de l'onglet Plan vient d'être livré (cf. `docs/superpowers/plans/plan-tab-manuel.md`).
> Ce document liste les prochaines vagues d'évolution, dans l'ordre des priorités probables.
> Statut : draft — à arbitrer avec Franck avant chaque vague.

## Vague 1 — Mode IA Coach

Remplacer le toggle "Bientôt" par un vrai mode de planification assistée.

- **Chat coach** dédié à la prépa (séparé du `/coach` existant) : conversation avec mémoire du plan, des contraintes (jours dispos, niveau, blessures), des courses cibles.
- **Génération automatique du plan** : à partir d'une course objectif + paramètres (heures/semaine, niveau, contraintes), produire les phases + semaine type + variations sur la durée totale de prépa.
- **Adaptation continue à la charge réelle** : recalculer/replanifier en lisant `lib/analytics/fatigue.ts` (CTL/ATL/TSB). Si TSB plonge → réduire la charge planifiée des 7 jours à venir. Si l'utilisateur saute une séance → proposer un rattrapage ou ajustement.
- **Suggestions de séances ciblées** : "tu n'as pas fait de VMA depuis 12 jours, voici 3 templates adaptés".

## Vague 2 — Intégrations Strava / Garmin

Comparer planifié vs réalisé pour fermer la boucle.

- **Liaison auto PlannedSession ↔ Activity** : matcher par date + type + tolérance ±1 jour, alimenter `linkedActivityId`.
- **Vue "planifié vs réalisé"** : sur chaque PlannedSession, afficher l'Activity associée (km / D+ / charge réalisée vs prévue), code couleur (vert si dans la cible ±10 %, orange si écart, rouge si manquée).
- **Statut séance** : passer auto `planned` → `completed` au matching ; bouton manuel pour `skipped` / `moved`.
- **Sync Garmin / Polar / Suunto** : étendre la lecture d'activités (en supplément de Strava) pour les utilisateurs multi-plateformes.

## Vague 3 — Notifications

Activer une couche de rappels et alertes proactives.

- **Rappel de séance** : push web (Web Push API) la veille / 2 h avant, opt-in via Profil.
- **Alerte charge** : si la charge planifiée sur 7 jours dépasse de >25 % la cible de la phase courante, notifier l'utilisateur dans l'app + push.
- **Récap hebdo** : tous les dimanches soir, un résumé "semaine planifiée vs réalisée + aperçu semaine prochaine".

## Vague 4 — Export & Partage

Sortir le plan hors de l'app pour les coachs humains et l'archivage.

- **Export PDF** du plan complet : couverture (course objectif, phases), 1 page par semaine type, légende intensités.
- **Partage avec coach humain** : lien public lecture seule (token éphémère) ou export ICS pour synchronisation calendrier.
- **Export ICS** du calendrier hebdo des séances planifiées (compat Google Calendar / Apple Calendar).

---

## Bonus reportés du MVP Mode Manuel

Items volontairement coupés du périmètre MVP pour rester dans le budget de la première livraison. Chacun a un mini-impact UX mais demande du polish ou de la logique supplémentaire.

### Calcul charge avec elevation factor avancé
Aujourd'hui la formule est `duration * intensityFactor * (1 + elevation/1000 * 0.15)` (cf. `web/lib/training/charge.ts`). Affiner :
- moduler le facteur D+ selon la technicité du terrain (à demander à l'utilisateur par séance ou inférer depuis l'historique).
- prendre en compte les descentes (cassure musculaire) en plus du D+.

### Mini-graph profil intensité par zone dans la carte PlannedSession
Façon Strava : afficher dans la carte journalière de VueSemaine un mini-bar SVG (~30 px de haut) qui représente la séquence des `TrainingZone[]` (warmup → main → cooldown), colorée par intensité. Donne une lecture immédiate de la structure de la séance sans ouvrir le modal.

### Coaching tips dynamiques par phase
Encart info dans `StructurePrepaBlock` qui change selon la phase courante : un tip court (~2 phrases) sur ce qu'il faut prioriser (volume, intensité, récup, gestion alimentaire…) — alimenté par `PHASE_DEFINITIONS[type].description` enrichi avec des conseils actionables.

### Validation visuelle (alerte enchaînement hautes intensités)
Dans VueSemaine, signaler visuellement (icône ⚠️ + tooltip) toute paire de séances haute intensité (intensity ≥ 4) sur 2 jours consécutifs. Le coach humain saurait éviter ça d'instinct ; l'app doit aider l'utilisateur à le voir.

### Microcycle pattern 3:1 (3 semaines progressives + 1 récup)
Auto-appliquer la cadence 3:1 sur une phase :
- semaines 1-3 : charge +5 %, +10 %, +15 % vs base
- semaine 4 : -30 % récup
Bouton "appliquer 3:1" dans `PhaseEditorModal`.

### Intégration calendrier Cockpit avec séances fantômes
Dans `WeekBlock` / `WeekActivitiesBlock` de Cockpit, afficher les `PlannedSession` à venir en **pointillé 60 % opacity** à côté des `Activity` réalisées. Permet de voir d'un coup d'œil la cohérence entre planning et réalisation, dans le même bloc. Logique de matching à partager avec la **Vague 2** (`linkedActivityId`).
