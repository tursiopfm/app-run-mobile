# Idees et mises a jour a venir

Ce document est ton espace de travail pour noter les idees, demandes, ameliorations et evolutions souhaitees.

## Comment l'utiliser

- ajoute une ligne des qu'une idee apparait
- deplace ensuite l'idee dans la bonne section
- passe une idee en "planifiee" quand elle est retenue
- passe une idee en "faite" quand elle est livree

## serveurs launch

Note importante : Le web app et le backend mobile partagent le même client_id=228003 mais ont des redirect_uri différents. Strava n'accepte qu'un seul callback domain à la fois. Il faudra switcher selon ce que tu testes :

Web app local → localhost
App mobile → excess-deceiver-throwback.ngrok-free.dev
Vercel prod → trail-cockpit.vercel.app

```
C:\Users\Franc\app-run-mobile\backend\strava-oauth> npm run dev
C:\Users\Franc\app-run-mobile\web> npm run dev
```

## Boite a idees

```md
- [ ] import FIT / GPX / TCX manuel
- [ ] connexion Garmin / Polar / Suunto
- [ ] suppression de compte (RGPD)
- [ ] politique de confidentialité
```

## A qualifier

- [ ] Authentification Strava avec plusieurs clients API
- [ ] Splash screen PWA
- [ ]

## Priorite haute

- [ ] Coach IA fonctionnel (OpenAI/Claude + `coach_messages` Supabase)
- [ ] Domaine personnalisé (trailcockpit.app ou équivalent)
- [ ] Cron jobs (sync sécurité quotidien, recalcul métriques, résumé hebdo)

## Priorite moyenne

- [ ] Détail activité : retirer le bloc CES de l'onglet STATS
- [ ] Lien ⋮ header : `/settings` → `/profile`
- [ ] Cockpit "Semaine en cours" : sélection par défaut ALL → RUN, redesign 7 cartes horizontales
- [ ] Historique vue "An" : afficher D+ par mois (parité avec Sem./Mois)
- [ ] Popup intensité : retirer emoji début de ligne (redondant avec label)
- [ ] Renommer "Distance hebdo" → "Km semaine", "Distance annuelle" → "Km année" (carte Goals)

## Priorite basse

- [ ] Centrer emoji intensité juste sous la valeur d'effort (pas en bas de carte)
- [ ] Conserver le panel recherche ouvert au retour depuis une activité
- [ ] Détail activité : poignée glassmorphism plus visible
- [ ] Détail activité : agrandir hauteur initiale carte (titre + date dessous)
- [ ]

## Planifie

- [ ] Coach IA — proposer des entrainements selon fatigue et objectifs
- [ ] Module "Entrainement" pour planifier par rapport à une course
- [ ] Tableau d'entrainement (vue planning hebdo/mensuel)
- [ ] Suppression de compte utilisateur (auto-service RGPD)
- [ ] Splash screen PWA + notifications push (post-domaine)

## En cours

### Migration Web App (Next.js) — état au 2026-05-09

**Cockpit + onglets**
- [x] Cockpit web grille de blocs swipeables multi-sports (11 blocs)
- [x] Drag-and-drop reorder + hide/restore + ajouter un bloc
- [x] SportSettingsModal pour activer/désactiver les sports affichés
- [x] Détail activité (`/activities/[id]`) avec carte Leaflet, splits, zones FC, stats, édition
- [x] Édition activité (sport, intensité manuelle, métriques, suppression)
- [x] Carte interactive : couches Plan/Satellite/Relief, marqueurs km, fullscreen, hybride

**Profil + CES v2**
- [x] Page Profil séparée (`/profile`) avec 6 modes de zones FC
- [x] CES v2 profile-aware (FTP, allure seuil, confidence, warnings)
- [x] `/api/profile/recalculate` — recalcul batch CES + fatigue après modif profil
- [x] Fatigue avec confidence (full/partial) quand historique < 42j
- [x] Migration 005 (threshold_pace) + 006 (effort_score_version)

**Strava + sync**
- [x] Webhook Edge runtime (cold start <2s) avec retry/backoff
- [x] Sync 30j sliding window pour propager renames/deletes
- [x] Soft-delete activités (anti-résurrection) — migration 008
- [x] Pull-to-refresh + foreground sync mobile

**Admin**
- [x] TabUsers avec suppression utilisateur
- [x] TabSync (sync individuel + masse)
- [x] TabWebhooks (logs réels via webhook_logs)
- [x] TabDeployments avec date+heure complète

**PWA**
- [x] Service worker + InstallPrompt (iOS-aware)
- [x] Icônes 192×192 et 512×512
- [x] Manifest standalone
- [x] Défilement vertical Android (toutes pages)

**Reste**
- [ ] Coach IA fonctionnel (skeleton actuel)
- [ ] Domaine personnalisé
- [ ] Cron jobs serveur
- [ ] Splash screen PWA

### Android

- [ ] Mode parité avec web (le focus est passé sur web depuis 2026-05-04)
- [ ] Suffer score propriétaire pour fonctionner sans abonnement Strava
- [ ] Page profil athlète web-équivalente

## Fait

- [x] Creation du document de suivi des idees et mises a jour
- [x] Migration Web App Next.js 14 complète (fondations → déploiement)
- [x] Strava OAuth production configuré (trail-cockpit.vercel.app)
- [x] Icônes PWA réelles générées (192px + 512px)
- [x] Profil athlète éditable web (FC, FTP, poids, objectif)
- [x] Nom utilisateur dans le header web + navigation vers settings
- [x] Page profil athlète (web + Android)
- [x] Cockpit personnalisable (drag-and-drop + visibilité)
- [x] Détail activité cliquable (parité Android)
- [x] Zones cardiaques configurables (6 modes : seuils physio, test terrain, Karvonen, %FC max, auto, perso)
- [x] CES v2 profile-aware (FTP, allure seuil utilisateur, confidence, warnings)
- [x] Recalcul historique CES + fatigue après modif profil
- [x] PWA installable (service worker, install prompt, manifest standalone)
- [x] Push webhook Strava production (Edge runtime)
- [x] Soft-delete activités (anti-résurrection)
- [x] Admin réelles données (users, sync, webhooks, deployments)
- [x] Carte interactive activité (Leaflet, couches, marqueurs km, fullscreen)
- [x] Filtre par type d'intensité dans liste activités
- [x] Popup vulgarisé "comme à un enfant de 10 ans" sur effort/intensité
- [x] Langue système FR/EN (localStorage + détection navigateur)
- [x] Couleurs sport : Course→orange, Vélo→vert, Natation→bleu

## Modele de fiche idee

```md
### Titre de l'idee
- besoin :
- valeur :
- ecrans impactes :
- fichiers probables :
- priorite :
- notes :
```

## Modele de demande de mise a jour

```md
### Mise a jour
- objectif :
- comportement attendu :
- contraintes :
- dependances :
- statut :
```
