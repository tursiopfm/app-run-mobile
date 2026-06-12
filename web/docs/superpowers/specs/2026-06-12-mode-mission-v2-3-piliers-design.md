# Mode Mission v2 — 3 piliers : Cockpit · Plan · Activités

> **Status: Design validé (maquette)** · 2026-06-12 · Maquette : `Prompts/mode-mission-3-piliers-mockup-v2.html`

## Contexte & problème

Le Mode Mission actuel est une grille Expert filtrée : 8 blocs (`MISSION_VISIBLE` dans
`components/cockpit/DashboardGrid.tsx`) + onglets Charge/Courses masqués. Retours
utilisateurs : encore trop compliqué, « des données partout ».

Étude des apps populaires : WHOOP (3 cadrans Sleep/Recovery/Strain), Garmin (1 score
0-100 → 1 consigne), Runna (onglet « Today »), Apple Fitness (3 anneaux). Motif commun :
**un visuel héros par concept, une couleur qui dit tout, un verdict en une phrase — le
détail accessible en tapant, jamais imposé.**

Cadrage produit : l'app ne gère ni sommeil ni HRV. Son identité = **données
d'entraînement, préparation/plan, objectif de course**, avec un futur module IA qui
agira sur le plan.

## Décisions de design

- **3 piliers = 3 onglets** en Mission : **Cockpit / Plan / Activités** (+ roue
  Réglages), icônes lucide actuelles (LayoutGrid, Calendar, Footprints, Settings) —
  continuité avec la nav Mission existante.
- **La course vit dans Plan** (bloc « Destination ») — pas d'onglet Courses en Mission.
- Règle par écran : **un héros, peu de blocs secondaires, le détail en tapant** vers les
  pages existantes (détail activité, plan complet, tableau de course). Aucune page de
  détail dupliquée.
- Parti pris créatif différenciant : **métaphore du poste de pilotage assumée**
  (briefing, état du pilote, cap, altitude, destination, journal de bord).
- L'« État de forme » dérive de la **fraîcheur TSB existante** (pas de readiness
  sommeil/HRV) et débouche toujours sur un **verdict actionnable** : continuer ou adapter.
- **Mode Expert inchangé.**

## Écran Cockpit — « je pilote » (5 blocs)

1. **Briefing du jour** — tuile d'entrée du rapport matinal (reprend `MorningReportTile`).
2. **État de forme** — échelle colorée Fatigué → Normal → Frais → Affûté avec curseur
   (position issue du TSB), badge d'état (libellés fraîcheur existants) et **verdict** :
   « ✓ Continue comme ça… » / « ⚠ Adapte : allège… ». Mapping statut → verdict à
   détailler au plan d'implémentation (réutilise `charge-thresholds` / `FreshnessCard`).
3. **Ma semaine** — 7 pastilles jour (fait ✓ / aujourd'hui / à venir / repos) + chiffre
   fort : km + D+ (heures si triathlon, cf. adaptation sport).
4. **Cap de la semaine** — jauges réalisé vs objectif du plan (volume, D+) avec repère
   « où tu devrais en être aujourd'hui » (`GoalsBlock` recontextualisé par la phase).
5. **Altitude · 6 semaines** — barres de volume hebdo, semaine courante en orange
   (le Cumul simplifié), avec tendance (↗ régulier…).

## Écran Plan — « ma feuille de route, jusqu'à la course » (5 blocs)

1. **Séance du jour** (héros) — type, durée, intensité, description courte ; teinte de la
   discipline. État « Repos » si pas de séance.
2. **Ma semaine d'entraînement** — 7 lignes (jour, séance, état : ✓ faite / ● auj. /
   à venir / —), aujourd'hui surligné.
3. **Destination** — J-X, nom, date, km/D+, objectif temps, mini profil altimétrique avec
   ravitos, lien vers le tableau de course. **État vide** : « Aucune course prévue →
   Ajouter une course ».
4. **Ma prépa** — anneau % séances faites (X sur Y) + frise Base / Spécifique / Affûtage
   avec curseur (Semaine X/Y).
5. **✨ Ajuster mon plan** — bouton Coach IA : point d'entrée réservé du futur module
   (placeholder tant que le module n'existe pas).

État vide global (pas de plan actif) : à traiter au plan d'implémentation (CTA vers la
création de plan / bibliothèque).

## Écran Activités — « mon journal de bord » (3 blocs + lien)

1. **Dernière sortie** (héros) — nom, km, D+, durée, trace du profil de la sortie.
   **Pas de score CES affiché** (décision explicite).
2. **Cumul du mois** — km, D+, nombre de sorties.
3. **Sorties récentes** — liste sobre (nom, date, km, D+, durée) +
   « Tout mon historique → ».

## Adaptation au sport principal (onboarding)

Structure et blocs identiques, **le contenu suit la discipline** (même principe que
`defaultSportForDiscipline` aujourd'hui) :

- **Course à pied** (défaut) : km + D+, accents `--data-run`.
- **Vélo** : données vélo, coches couleur `--data-bike` (#27A971).
- **Triathlon** : pastilles colorées par discipline (`--data-swim` / `--data-bike` /
  `--data-run`), chiffre fort en **heures** avec répartition (« 2h00 nat · 5h00 vélo ·
  1h45 cap »), Cap de la semaine en heures, séance du jour taguée discipline.

## Hors périmètre

- Mode Expert (intact), pages de détail existantes.
- Le module Coach IA lui-même (seul le point d'entrée est posé).
- Déclinaison desktop précise (sidebar 3 entrées, contenu centré) : à décliner au plan
  d'implémentation.

## Données / dépendances

Tout existe déjà : fraîcheur (`lib/analytics/fatigue.ts`, `charge-thresholds`), plan et
phases (`lib/plan/storage`, `lib/training/phases`), course + tableau (`races`,
`race_waypoints`), activités. Pas de migration Supabase pressentie.
