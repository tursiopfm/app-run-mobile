# TODO — Corrections & améliorations Trail Cockpit — 7 mai 2026 (V2)

## 🏃 Onglet Activités — Liste

- [ ] Popup intensité : retirer l'emoji en début de chaque ligne (redondant avec le label)
- [ ] Centrer emoji intensité juste sous la valeur d'effort (pas en bas de carte)
- [ ] Conserver le panel recherche ouvert au retour depuis une activité

## 🏃 Onglet Activités — Détail d'une activité

- [ ] Poignée carte : rendre visible (fond glassmorphism)
- [ ] Agrandir la hauteur initiale de la carte pour ne voir que titre + date en dessous
- [ ] Onglet STATS : retirer le bloc CES

## 👤 Page Profil (via ⋮ dans l'entête)

- [x] Changer le lien ⋮ de /settings → /profile
- [x] Restructurer la page Profil :
  - [x] Section "Méthode de calcul des zones" (existant)
  - [x] Section "Source des valeurs" (nouveau — localStorage)
  - [x] Section "Données cardio" (FC max, AeT, LTHR)
  - [x] Section "Infos athlète" (poids, année naissance)
  - [x] Section "Zones FC utilisées" (calcul live TypeScript, Z1→Z5)
- [x] Migration Supabase : `aerobic_threshold_hr` + `birth_year` sur `profiles` (migration 004)
- [x] Mettre à jour l'API `/api/profile` pour autoriser les nouveaux champs

## 🎯 Onglet Cockpit — Bloc Objectif

- [x] Renommer "Distance hebdo" → "Km semaine"
- [x] Renommer "Distance annuelle" → "Km année"

## 📊 Onglet Cockpit — Historique

- [ ] Vue "An" : afficher le D+ par mois (comme Sem. et Mois)

## 📊 Onglet Cockpit — Semaine en cours

- [ ] Changer la sélection par défaut de ALL → RUN
- [ ] Redesign : 7 cartes de jours horizontales
  - Actif = fond orange + km en orange + D+ en bleu
  - Repos = transparent
  - Total : km orange · D+ bleu · Durée en vert

---

*Généré le 7 mai 2026 — Trail Cockpit PWA — suite à la session de corrections V2*
*Mis à jour le 9 mai 2026 — items profil/page profil/Goals livrés*
