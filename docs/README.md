# Documentation Trail Cockpit

> Index unique de la doc — source de vérité pour le projet.
> Tu cherches l'app ? Le code actif est dans [`web/`](../web/) (Next.js, déployé sur Vercel).

## Reference — docs vivantes (à lire en début de session)

| Fichier | Contenu |
|---|---|
| [reference/ARCHITECTURE.md](./reference/ARCHITECTURE.md) | Stack web actuelle, dossiers, flux critiques (auth, Strava, CES) |
| [reference/BLUEPRINT_CES.md](./reference/BLUEPRINT_CES.md) | Modèle CES multi-sport profile-aware (vision + math de haut niveau) |
| [reference/MODELE_MATHEMATIQUE.md](./reference/MODELE_MATHEMATIQUE.md) | Source de vérité math : zones HR, intensité, CES, charge/fatigue |
| [reference/MAINTENANCE.md](./reference/MAINTENANCE.md) | Checklist maintenance et opérations |
| [reference/MINMAP.md](./reference/MINMAP.md) | Index rapide écrans ↔ composants |

## Superpowers — designs et plans

- [`superpowers/specs/`](./superpowers/specs/) : specs de design (un par feature). Bandeau `Status: Implémenté` en tête quand la feature est livrée.
- [`superpowers/plans/`](./superpowers/plans/) : plans d'implémentation détaillés.

## Archive — docs historiques ou supersedées

Voir [`archive/`](./archive/) — anciennes versions, TODOs terminés, docs Android legacy.

## Tâches & lessons

- [`../tasks/backlog.md`](../tasks/backlog.md) — backlog vivant des travaux différés
- [`../tasks/lessons.md`](../tasks/lessons.md) — leçons apprises (1 entrée à chaque correction de Franck)

## Règles de maintenance de la doc

Quand on implémente une feature liée à une spec :
1. Ajouter le bandeau `> **Status: Implémenté** · YYYY-MM-DD · Code: <chemin>` en tête de la spec correspondante.
2. Si le code dévie significativement du design initial, ajouter une section `## Drift notes` à la fin avec 2-3 bullets.

Quand on découvre du travail différé : l'ajouter à [`../tasks/backlog.md`](../tasks/backlog.md).

Quand Franck corrige une approche : appender une ligne à [`../tasks/lessons.md`](../tasks/lessons.md) au format `[YYYY-MM-DD] | ce qui s'est mal passé | règle à suivre`.

Quand un doc de référence est touché par une fonctionnalité (CES, charge, intensité, auth, etc.) : mettre à jour le doc concerné dans `reference/` dans la même PR.
