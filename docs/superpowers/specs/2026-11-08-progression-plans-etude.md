# Étude : progression des cibles hebdo dans les plans d'entraînement

> **Status: Implémenté** · 2026-11-08 · Code: `web/lib/training/progression.ts` (branché dans `StructurePrepaBlock` + `PhaseEditorModal`, base calculée dans `PlanClient`)

## 1. Constat : ce que fait l'app aujourd'hui

`autoDistributePhases(startDate, raceDate)` découpe la prépa en mésocycles (Foncier / Développement / Spécifique / Affûtage). Chaque phase reçoit **une seule** cible km / D+ / charge, tirée de constantes fixes :

| Phase | km/sem | D+/sem | Charge/sem |
|---|---|---|---|
| Foncier | 50 | 800 | 300 |
| Développement | 60 | 1000 | 400 |
| Spécifique | 70 | 1500 | 450 |
| Affûtage | 40 | 600 | 250 |

`getPhaseWeeks` / `resolveWeeklyTarget` reprennent ensuite cette valeur pour **toutes les semaines de la phase**. Seule exception : `phase.weeklyTargets[i]`, mais ce tableau n'est rempli qu'à la main dans `PhaseEditorModal`.

Quatre défauts en découlent :

1. **Aucune progression dans une phase.** On a un plateau par phase, avec une marche brutale entre deux phases (par exemple +20 % de km et +50 % de D+ entre Développement et Spécifique).
2. **Aucune semaine de récupération.** Pas de cycle 3:1, donc pas d'assimilation, et une monotonie élevée (au sens de Foster).
3. **L'objectif n'est pas pris en compte.** `distance` et `elevation` de la `Race` (`goalRaceId`) ne sont jamais lus. Un 10 km route et l'UTMB reçoivent exactement les mêmes 50 km / 800 m.
4. **Le niveau actuel de l'athlète n'est pas pris en compte.** Le point de départ ne dépend pas du volume réellement couru. Selon les cas, c'est un saut de charge dangereux ou un sous-entraînement.

## 2. Ce que font les plans habituels

### 2.1 Point de départ = volume actuel
Tous les auteurs (Daniels, Pfitzinger, Koop, Uphill Athlete) partent du volume moyen des 4 à 6 dernières semaines. Ils ne partent jamais d'une valeur générique. Uphill Athlete l'écrit explicitement dans ses plans : *« You will determine the starting weekly distance and vertical gain/loss based on the event you are training for »* ([Big Vert Ultra](https://uphillathlete.com/?p=14157)).

### 2.2 Montée progressive du volume
- La « règle des 10 % » est empirique. Nielsen et al. observent un risque de blessure accru au-delà de **+30 % sur 2 semaines** ([JSCR 2013](https://research.rug.nl/en/publications/can-gps-be-used-to-detect-deleterious-progression-in-training-vol/), [JOSPT 2014](https://www.orthobethesda.com/wp-content/uploads/2020/06/jospt-running-increased-mileage.pdf)).
- La revue systématique de Damsted (2018) juge cependant les preuves faibles ([résumé](https://runsafe.au.dk/display/artikel/limited-evidence-on-changes-in-training-load-and-running-related-injury)).
- En pratique, la fourchette retenue est **+5 à +10 % par semaine de charge**, et environ +15 à 20 % au maximum pour le D+, qui est moins étudié.

### 2.3 Cycle de charge « en escalier » (3:1)
- Le schéma classique enchaîne 3 semaines de charge croissante puis 1 semaine de récupération à **−25 à −35 %**. Le 2:1 est préférable pour les masters ou en bloc très chargé.
- Le bloc suivant redémarre **au-dessus** du début du bloc précédent. La courbe ressemble donc à un escalier en dents de scie, pas à une rampe ni à un plateau.

### 2.4 Rôle de chaque phase
| Phase | Volume | D+ | Intensité |
|---|---|---|---|
| Foncier | ↗ monte (bloc principal de construction) | ↗ modéré | basse |
| Développement | → se stabilise ou monte doucement | ↗ | ↗ seuil / VMA |
| Spécifique | **pic** | **pic, à la densité m/km de la course** | allure course, sorties longues, back-to-back |
| Affûtage | ↘ −40 à −60 %, décroissance exponentielle | ↘ | **maintenue** |

### 2.5 Affûtage
La méta-analyse de Bosquet (2007) conclut qu'un affûtage optimal dure **2 semaines**, avec un volume réduit de **41 à 60 %** de façon exponentielle et une intensité maintenue ([PubMed](https://pubmed.ncbi.nlm.nih.gov/17762369/)). Pour les ultras, on voit souvent 2 à 3 semaines.

### 2.6 Calibrage sur l'objectif (distance et D+)
- **Volume au pic.** Le ratio pic hebdo / distance de course diminue quand la distance augmente :
  - environ 2 à 3× pour un 10 à 20 km ;
  - environ 1,7 à 2× pour un marathon ou un trail de 40 km ;
  - environ 1× pour un 80 à 100 km ;
  - environ 0,6 à 0,7× pour un 160 km et plus.
  - Exemples : les plans Uphill Athlete culminent à ~66 km et >4000 m D+ pour un 100 K, et à ~78 km et ~4600 m D+ pour un 100 miles ([plans TrainingPeaks](https://trainingpeaks.com/training-plans/running/ultra/tp-468167/trail-running-100-kilometer-rpe)).
- **D+ au pic.** Il découle de la **densité de la course** (D+ / km). La semaine spécifique reproduit cette densité, avec un plafond autour de 50 à 100 % du D+ total de la course. Une méthode courante applique le même pourcentage de la course au km et au D+ ([forum Uphill Athlete](https://uphillathlete.com/?p=20605)).
- **Sortie longue la plus longue.** Elle représente environ 30 à 50 % de la distance de course pour les ultras, souvent en back-to-back le week-end. Elle relève des séances et sort du périmètre de cette étude.

> Les ratios ci-dessus sont des **heuristiques de coaching**. Ils viennent des plans publiés et de la pratique (Koop, *Training Essentials for Ultrarunning* ; Johnston & House, *Training for the Uphill Athlete*), pas d'une loi validée.

## 3. Proposition de modèle

**Entrées :**
- distance et D+ de l'objectif (`Race` via `goalRaceId`) ;
- phases (déjà calculées) ;
- base de l'athlète : moyenne km et D+ des 4 dernières semaines.

**Étapes :**
1. **Pic visé.**
   - `peakKm = clamp(40 + 0,45 × raceKm, base, 130)`. Cette formule donne environ 50 km pour un 20 km, 59 km pour 42 km, 76 km pour 80 km, 85 km pour 100 km et 116 km pour 170 km.
   - `peakDplus = min(0,7 × raceDplus, peakKm × densitéCourse)`.
2. **Atteignabilité.**
   - On vérifie si `peakKm` est accessible depuis `base` avec +8 %/sem sur les semaines de charge.
   - Si ce n'est pas le cas, on plafonne et on affiche un warning (« prépa trop courte pour ce volume »).
3. **Profil hebdo.**
   - Semaines de charge à +5 à 10 %, une semaine de récup sur 4 (−30 %) alignée sur les fins de phase quand c'est possible.
   - Spécifique au pic.
   - Affûtage : environ −30 % en S-2, environ −55 % en semaine de course (hors course).
4. **Charge (CES/sem).** Même forme que le km. Aujourd'hui elle est aussi constante.

**Exemple : 12 semaines, objectif 80 km / 4000 m (50 m/km), base actuelle 45 km / 700 m.**
Découpage actuel conservé : Foncier 4 / Développement 3 / Spécifique 3 / Affûtage 2.

| Sem | Phase | km | D+ | Commentaire |
|---|---|---|---|---|
| 1 | Foncier | 48 | 800 | +7 % |
| 2 | Foncier | 52 | 950 | |
| 3 | Foncier | 56 | 1100 | |
| 4 | Foncier | 40 | 750 | récup −30 % |
| 5 | Dév. | 60 | 1350 | redémarre au-dessus de S3 |
| 6 | Dév. | 66 | 1650 | |
| 7 | Dév. | 48 | 1100 | récup |
| 8 | Spécifique | 72 | 2050 | |
| 9 | Spécifique | 76 | 2400 | pic km |
| 10 | Spécifique | 72 | 2700 | pic D+ (≈ 68 % du D+ course) |
| 11 | Affûtage | 50 | 1500 | −35 % |
| 12 | Affûtage | 30 | 700 | −60 % + course |

À comparer avec le résultat actuel : 50/800 ×4, 60/1000 ×3, 70/1500 ×3, 40/600 ×2, quels que soient l'objectif et l'athlète.

## 4. Impact technique (sans migration)

- `phase.weeklyTargets` existe déjà : colonne jsonb `weekly_targets`, lue par `getPhaseWeeks`, `resolveWeeklyTarget` et les blocs Mission, et éditable dans `PhaseEditorModal`.
- Il suffit d'une fonction pure `generateWeeklyTargets(phases, { raceKm, raceDplus, baseKm, baseDplus })` qui remplit ce tableau. On l'appelle là où `autoDistributePhases` est utilisé (`StructurePrepaBlock`, `PhaseEditorModal`).
- Les `weeklyDistanceKmTarget` / `weeklyElevationMTarget` de phase deviennent la moyenne de la phase et servent seulement de repli.

## 5. Questions ouvertes (à trancher par Franck)

1. Cycle **3:1** par défaut, ou **2:1** ? Ou un réglage dans le profil ?
2. Base athlète : moyenne des **4 dernières semaines** d'activités, ou CTL convertie ?
3. Plans existants : régénérer leurs cibles, ou n'appliquer le nouveau modèle qu'aux nouveaux plans et sur le bouton « auto-distribuer » ?
4. Si l'utilisateur a modifié des semaines à la main, faut-il les écraser à la régénération ?
5. Sans objectif lié (`goalRaceId` null), faut-il seulement une progression depuis la base, sans calibrage sur la course ?

## Décisions (Franck, 2026-11-08)

Cycle 3:1, base = moyenne des 4 dernières semaines d'activités course (Run/TrailRun), **nouveaux plans uniquement** (création + « Auto-générer »). Les plans existants ne sont pas touchés.

## Drift notes

- Récup 3:1 placée par simple compteur (toutes les 4 semaines de charge, remis à zéro par une phase Récupération) et non alignée sur les fins de phase. Exception : une récup qui tomberait juste avant l'affûtage est convertie en semaine de charge.
- Affûtage : −20 % (S-3 si affûtage ≥ 3 sem), −35 % (S-2), −55 % (semaine de course), relatif à la dernière semaine de charge.
- D+ : croissance plafonnée à +20 %/sem, d'où un pic légèrement sous la cible si la prépa est courte (exemple §3 : 2700 m au lieu de 2800 m).
- Sans activité récente : départ à 60 % du pic. Sans objectif (distance 0) : pic = base × 1,15.
- **Charge hebdo (CES) non progressée** : `weeklyChargeTarget` reste la constante de phase (`PhaseWeeklyTarget` ne porte que km/D+). À traiter si besoin.
