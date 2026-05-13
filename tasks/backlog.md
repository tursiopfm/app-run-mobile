# Backlog

## Migrations / améliorations différées

### Migrer le profil FC (zones cardiaques) vers Supabase
- **Quoi** : actuellement le profil cardiaque (zones FC, FC max, FC repos, seuils, méthode) est stocké en `localStorage` du navigateur (clés `tc_athlete_hr` et `tc_hr_zone_method`).
- **Problème** : le profil ne suit pas l'utilisateur entre navigateurs / appareils. En local dev, le profil est vide → l'intensité s'affiche "Non mesurée" pour toutes les activités, même si elles ont `avg_hr` en base.
- **À faire** :
  1. Créer une table `athlete_profile` (ou colonnes dans `profiles`) côté Supabase avec : `hr_zone_method`, `max_hr`, `resting_hr`, `aerobic_threshold_hr`, `threshold_hr`, `birth_year`, `custom_zones` (jsonb).
  2. Côté client, lire/écrire ce profil via Supabase plutôt que localStorage.
  3. Migration douce : au premier load, si le profil DB est vide mais localStorage rempli → push vers Supabase puis purge localStorage.
- **Pourquoi** : permettre à Franck de voir ses zones d'intensité correctement sur n'importe quel navigateur ou device, sans avoir à reconfigurer.
- **Identifié le** : 2026-05-13
