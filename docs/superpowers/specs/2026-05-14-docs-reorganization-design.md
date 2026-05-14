---
title: Réorganisation et mise à jour de la documentation
date: 2026-05-14
status: En cours
---

# Réorganisation de la documentation Trail Cockpit

## Contexte

La documentation est éparpillée entre `/docs/` (39 fichiers, principal) et `/web/docs/` (7 fichiers orphelins). Plusieurs docs sont obsolètes ou contradictoires :

- `BLUEPRINT_COCKPIT_TRAIL_CHARGE_EFFORT.md` (v1 mono-sport) est superseded par `BLUEPRINT_COCKPIT_TRAIL_CHARGE_EFFORT_MULTISPORT.md` (v2)
- `MODELE_MATHEMATIQUE_INTENSITE_CES.md` et `REFERENCE_EFFORT_FC_INTENSITE.md` couvrent le même périmètre
- `TODO-mise-a-jour-7-5-26.md` (V1, terminé) et `TODO-mise-a-jour7-5-26-V2.md` (en cours) cohabitent
- `tasks/lessons.md` est vide alors que CLAUDE.md impose de le tenir à jour

## Décisions

1. **Consolidation** : tout sous `/docs/`. `/web/docs/` disparaît.
2. **Specs IMPL** : bandeau `> Status: Implémenté · YYYY-MM-DD · Code: …` en tête + note de drift si écart avec le code. Pas de réécriture.
3. **Docs LIVING** : revue complète pour refléter la stack web actuelle.
4. **Archive** : `/docs/archive/` pour les docs terminées ou supersedées.
5. **Index** : `/docs/README.md` liste les docs vivantes.
6. **Règle d'auto-maintenance** ajoutée à CLAUDE.md.

## Arborescence cible

```
docs/
  README.md                   ← index (nouveau)
  reference/
    ARCHITECTURE.md
    BLUEPRINT_CES.md          ← renommé depuis _MULTISPORT
    MODELE_MATHEMATIQUE.md    ← fusion MODELE + REFERENCE_EFFORT_FC
    MAINTENANCE.md
    MINMAP.md
  superpowers/
    plans/                    ← 16 + 4 (de web/docs) = 20 fichiers
    specs/                    ← 14 + 3 (de web/docs) = 17 fichiers + ce spec
  archive/
    BLUEPRINT_v1.md
    REFERENCE_EFFORT_FC_INTENSITE.md  (fusionné dans MODELE_MATHEMATIQUE.md)
    TODO-7-5-26-v1.md
    trail-cockpit-mise-en-ligne.md
    IDEES_ET_MISES_A_JOUR.md (items vivants migrés vers tasks/backlog.md)
    i18n-android-2026-04-28-spec.md
    i18n-android-2026-04-28-plan.md
```

## Contradictions résolues

| Conflit | Résolution |
|---|---|
| BLUEPRINT v1 vs v2 | v1 → archive, v2 → `reference/BLUEPRINT_CES.md` |
| MODELE vs REFERENCE_EFFORT_FC | Fusion dans `reference/MODELE_MATHEMATIQUE.md` |
| TODO V1 vs V2 | V1 → archive ; items V2 restants → `tasks/backlog.md` |
| HR : `hr-deduce.ts` introuvable | **Faux positif** — fichier existe à `web/lib/health/hr-deduce.ts` |
| Seuils Charge 0.75/1.25/1.5 vs 0.85/1.15 | **Pas une contradiction** : 2 fichiers, 2 usages — `charge-thresholds.ts` (insights généraux) vs `charge-kpi-status.ts` (verdicts coach) |

## Règle ajoutée à CLAUDE.md

> **Maintenance de la documentation**
> - Quand on implémente une feature liée à une spec dans `docs/superpowers/specs/`, ajouter le bandeau `Status: Implémenté · date · code:` en tête.
> - Quand on découvre du travail différé pendant une session, l'ajouter à `tasks/backlog.md`.
> - `tasks/lessons.md` se met à jour à chaque correction de Franck (règle pré-existante).

## Exécution

Phases (dans cet ordre) :

1. Mini-spec écrit, commité (ce fichier).
2. Déplacements `git mv` (préserve l'historique).
3. Bandeau Status sur 28 specs/plans IMPL (subagent parallèle).
4. Mise à jour des 4 docs LIVING (subagent).
5. Migration TODOs+IDEES → `tasks/backlog.md`.
6. `docs/README.md` + maj CLAUDE.md.
7. Commit final.

## Risques

- **Préservation historique git** : utiliser `git mv` plutôt que `mv`.
- **Liens internes** : certaines docs se référencent par chemin relatif. Faire un grep `docs/` après les déplacements pour réparer les liens.
- **Effort scope** : si une spec a sérieusement divergé du code, je m'arrête et te le signale plutôt que de réécrire en silence.
