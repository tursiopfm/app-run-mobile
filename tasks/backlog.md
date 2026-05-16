# Backlog

> Source unique des travaux différés Trail Cockpit.
> Mise à jour : 2026-05-14 (consolidation depuis IDEES_ET_MISES_A_JOUR.md + TODO V2).

## Priorité haute

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

## Priorité basse

### Détail activité
- [ ] Centrer emoji intensité juste sous la valeur d'effort (pas en bas de carte)
- [ ] Poignée carte : fond glassmorphism plus visible
- [ ] Agrandir hauteur initiale de la carte (titre + date dessous)

### Navigation
- [ ] Conserver le panel recherche ouvert au retour depuis une activité

### PWA
- [ ] Splash screen PWA (post-domaine personnalisé)

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
- Vercel prod → `trail-cockpit.vercel.app`

Commandes :
```
C:\Users\Franc\app-run-mobile\backend\strava-oauth> npm run dev
C:\Users\Franc\app-run-mobile\web> npm run dev
```

---

## Modèle de fiche pour un nouvel item

```md
### Titre
- **Quoi** : description courte
- **Pourquoi** : valeur / motivation
- **À faire** (optionnel) : étapes
- **Identifié** : YYYY-MM-DD
```
