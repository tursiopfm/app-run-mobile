# Mode Mission v2 — 3 piliers : Cockpit · Plan · Activités

> **Status: Implémenté** · 2026-06-12 · Code: `web/components/mission/` + `web/lib/mission/` · Maquette : `Prompts/mode-mission-3-piliers-mockup-v2.html`
> **Révision Cockpit (design A)** · 2026-06-12 · Maquette : `Prompts/cockpit-mission-blocs-v2-mockups.html` — voir section « Écran Cockpit »

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

## Écran Cockpit — « je pilote » (6 blocs, design A « Glass Cockpit » révisé)

> Redesign validé le 2026-06-12 sur maquette
> `Prompts/cockpit-mission-blocs-v2-mockups.html` (direction A). Titres de blocs en
> police brand (Space Grotesk 15px semibold muted, comme l'Expert), pas de décoration.
> Le header reste celui du shell Mission (TrailCockpit · bouton Expert · nom athlète).

1. **Briefing du jour** — tuile d'entrée du rapport matinal (reprend `MorningReportTile`).
2. **État de forme** — cadran SVG à aiguille (zones colorées alignées sur `FRESHNESS`),
   valeur TSB en grand, delta vs 7 j (« ↗ +3 · tu remontes »), verdict une phrase.
   **Badge d'état en haut à droite = `TsbBadge` cliquable** → ouvre la fenêtre Expert
   existante **`FreshnessHelpSheet`** (« Fraîcheur — que faire ? », zone courante surlignée).
3. **Ma semaine** — 7 pastilles jour (fait ✓ / aujourd'hui / à venir / repos) + chiffre
   fort : km + D+ (heures si triathlon) + **bouton « Objectif »** en haut à droite →
   fenêtre de saisie : volume semaine (km), dénivelé semaine (m), volume année (km).
   Stockage = **mêmes clés localStorage que le `GoalsBlock` Expert**
   (`cockpit_goals_targets`, par sport) — objectifs partagés entre les deux modes.
4. **Objectif** — 3 barres avec repère « attendu aujourd'hui » : semaine·volume (orange),
   semaine·dénivelé (bleu), **année·volume (vert)**. Cibles semaine : override utilisateur
   sinon cible du plan (`resolveMissionWeeklyTarget`). Année sans objectif saisi →
   **projection fin d'année** (barre pointillée, `ytdKm / fraction d'année écoulée`).
   Le bloc n'apparaît que s'il existe au moins une cible (saisie ou plan).
5. **Sessions de la semaine** — liste des activités réalisées de la semaine (jour, nom,
   km, D+) + ligne de totaux (km · D+ · durée). Données : `weekActivities` (déjà fetchées
   par la page dashboard).
6. **Cumul km · mois** — réutilise **`CockpitCumulChart`** de l'Expert
   (`SportOverview.cumulMonths` / `cumulYears`) : valeurs de fin de courbe et infobulle
   au doigt natives. Bouton bascule en haut à droite : **« Année » ⇄ « Mois »**.

Supprimés par ce redesign : « Cap de la semaine » (absorbé par Objectif) et
« Altitude · 6 semaines » (remplacé par Sessions de la semaine + Cumul).

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

## Drift notes

Écarts assumés entre la spec/maquette et l'implémentation (2026-06-12) :

- **Triathlon — pastilles de la semaine non colorées par discipline.** La maquette
  colore chaque pastille selon la discipline du jour (nat bleue, vélo verte, cap
  orange) ; `SportOverview` agrège par sport mais n'expose pas la discipline dominante
  par jour → pastilles en couleur par défaut pour les triathlètes. À reprendre si la
  donnée jour×discipline devient disponible.
- **Triathlon — « Cap de la semaine » reste en km/D+.** La spec prévoyait une bascule
  en heures ; le modèle de phases (`PhaseWeeklyTarget`) n'a pas de cible horaire,
  uniquement km/D+. La carte affiche donc la cible du plan telle quelle.
- **Activités — pas de trace du profil sur la dernière sortie** (nécessite les
  streams) ni de titre « Sorties récentes » au-dessus de la liste. Backlogués.
