> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/components/settings/HrCalibrationCard.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Module Profil FC — Refonte pro

**Date** : 2026-05-11
**Cible** : web/ (Next.js / PWA)
**Page concernée** : `web/app/(main)/profile/page.tsx`

---

## 1. Objectif

Refondre le module FC du profil pour le rendre pro, adapté du débutant au confirmé. Sept méthodes de calcul de zones, champs affichés conditionnellement selon la méthode active, contenus pédagogiques (protocole test 30 min, info FC repos), panneau de traçabilité des sources.

---

## 2. Architecture cible

### 2.1 Structure de la page

```
app/(main)/profile/page.tsx
├─ <IdentityCard />               (existant, inchangé)
├─ <HrCalibrationCard />          (NOUVEAU — regroupe méthode + champs + save)
│  ├─ <HrZoneMethod />            (étendu — 7 méthodes, badges colorés)
│  ├─ <HrCardioFields />          (NOUVEAU — affichage conditionnel)
│  │  ├─ <TestProtocolModal />    (NOUVEAU)
│  │  ├─ <RestingHrInfoPopover /> (NOUVEAU)
│  │  └─ <CustomZonesEditor />    (NOUVEAU)
│  └─ <SaveButton />              (extrait de l'existant)
├─ <HrSourcesPanel />             (NOUVEAU — table lecture seule)
└─ <HrZonesDisplay />             (existant, inchangé)
```

### 2.2 Composants supprimés

- `ProfileSourceSection` (toggle manuel/auto — remplacé par les méthodes `deduced` / `custom`)
- `ProfileCardioSection` (remplacé par `HrCalibrationCard`)

---

## 3. Les 7 méthodes

| # | Clé | Libellé | Fiabilité | Couleur | Champs requis |
|---|---|---|---|---|---|
| 1 | `seuils` | Seuils physiologiques | Excellent | Vert `#22c55e` | FC max + AeT + LTHR |
| 2 | `test30` | Test terrain 30 min | Très bien | Vert `#22c55e` | FC max + FC seuil 30min |
| 3 | `karvonen` | Réserve FC / Karvonen | Bien | Jaune `#facc15` | FC max + FC repos |
| 4 | `pct_max` | % FC max | Correct | Orange `#fb923c` | FC max |
| 5 | `auto` | Estimation automatique | Approximatif | Rouge `#f87171` | Année naissance (FC max calculée) |
| 6 | `deduced` | Déduire automatiquement | Adaptatif | Orange `#fb923c` | aucun (lit `activities`) |
| 7 | `custom` | Personnalisé | Custom | Gris `#9ca3af` | 5 zones Z1–Z5 manuelles |

**Comportement** :
- Clic sur une méthode → bordure + halo léger dans la couleur de fiabilité.
- Animation fade 150 ms quand on change de méthode.
- Valeurs saisies persistées en localStorage même si on change de méthode (FC max saisie pour Karvonen reste si on passe à %FC max).

---

## 4. Champs conditionnels par méthode

### 4.1 `seuils`
- FC max (bpm) — saisie
- Seuil aérobie / AeT (bpm) — saisie
- Seuil anaérobie / LTHR (bpm) — saisie

### 4.2 `test30`
- FC max (bpm) — saisie
- FC seuil test 30 min (bpm) — saisie
- Bouton **« 📖 Voir le protocole »** → ouvre `TestProtocolModal`

### 4.3 `karvonen`
- FC max (bpm) — saisie
- FC repos (bpm) — saisie + icône **« i »** à droite du label → ouvre `RestingHrInfoPopover`

### 4.4 `pct_max`
- FC max (bpm) — saisie

### 4.5 `auto`
- FC max estimée (bpm) — **lecture seule** (208 − 0.7 × âge), recalculée live à la saisie de l'année
- Année de naissance — **requis**, bordure d'alerte orange si vide

### 4.6 `deduced`
- Aucun champ à remplir
- Panneau « Détecté depuis Strava » affichant `maxHrObserved`, `restingHrEstimated`, `lthrEstimated`
- Bouton **« 🔄 Recalculer depuis l'historique »** — force un recompute
- Si pas d'activités → message « Importe des activités Strava pour activer ce mode »

### 4.7 `custom`
- Grille Z1–Z5 (5 lignes Min / Max)
- **Validation live** : zones continues (Z(n).max + 1 = Z(n+1).min), croissantes, sans chevauchement
- Texte d'aide sous la grille (cf. screenshot fourni)

---

## 5. Modale `TestProtocolModal`

Ouverte par le bouton « 📖 Voir le protocole » sur la méthode `test30`. Fermable par × ou bouton bas.

### Contenu

**✓ À faire avant**
- Repos complet 24h, hydratation, pas d'alcool la veille
- Choisir un parcours plat ou piste, par temps tempéré
- Échauffement 15 min progressif (Z1 → Z3)

**⏱ Pendant le test**
- Cours 30 minutes en continu à allure maximale soutenable
- Démarre à un rythme que tu sais tenir 30 min — pas un sprint
- Démarre le lap après 10 min de test (clé du protocole)
- Garde un effort très régulier sur les 20 dernières minutes

**📊 Lecture du résultat**
- FC moyenne des 20 dernières minutes = ta LTHR
- C'est cette valeur que tu reportes dans le champ « FC seuil test 30 min »

**💡 À refaire** tous les 3–6 mois ou après un bloc d'entraînement structurant. La LTHR évolue avec ta forme.

Source : protocole standard Coggan / Friel.

---

## 6. Popover `RestingHrInfoPopover`

Ouverte par le « i » à côté de FC repos sur la méthode `karvonen`. Fermable par clic ailleurs / Esc. Pas full-screen, ancré sous le champ.

### Contenu

**🛏 Méthode manuelle** — Le matin, juste après le réveil, avant de te lever. Compte tes pulsations 60 secondes. Refais sur 3 matins, garde la moyenne.

**⌚ Sur ta montre / appli**
- **Garmin Connect** : Plus ... (en bas à droite) → Statistiques de santé → Fréquence cardiaque → 7j (en bas à gauche)
- **Apple Watch** : Santé → Cœur → Fréquence cardiaque au repos
- **Coros** : App → Santé → FC au repos (mesure nocturne)
- **Polar / Suunto / Fitbit** : section « Repos / RHR » de l'app

**💡 La FC repos varie. Note plutôt la moyenne sur 7–14 jours, hors période de fatigue / malade.**

---

## 7. Panneau `HrSourcesPanel` (lecture seule)

Tableau à 4 colonnes : **Valeur / Utilisée / Source / Maj**.

Lignes affichées (toujours les 6, masquées seulement si tout est null) :
1. FC max (saisie utilisateur)
2. FC repos (saisie utilisateur)
3. FC max observée (Strava, max sur 365j)
4. FC repos estimée (Strava, médiane min HR sur 90j)
5. LTHR estimée (calculée, p95 FC sur runs ≥ 30 min)
6. FC max estimée (Tanaka, à partir année naissance)

### Types de source (badges colorés)
- `✓ Saisie` (vert) — saisie utilisateur
- `📡 Strava` (orange) — lu depuis `activities`
- `∫ Calculée` (jaune) — déduite par formule
- `📅 Âge` (gris) — formule Tanaka

### Mise en avant
Les valeurs **utilisées par la méthode active** apparaissent en **gras blanc**. Les autres sont en gris (info, dispos si on change de méthode).

Bloc **masqué** si le profil est totalement vide (premier login).

---

## 8. Modèle de données

### 8.1 Supabase — migration `006_hr_zone_method.sql`

```sql
ALTER TABLE profiles
  ADD COLUMN hr_zone_method       text,
  ADD COLUMN hr_zones_custom      jsonb,
  ADD COLUMN hr_method_updated_at timestamptz;

-- valeurs autorisées de hr_zone_method :
--   'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'deduced' | 'custom'
-- hr_zones_custom : uniquement si hr_zone_method = 'custom'
--   format : [{"zone":1,"min":null,"max":120}, ..., {"zone":5,"min":156,"max":190}]
```

À fournir à Franck dans le Dashboard Supabase (les migrations ne s'auto-appliquent pas).

### 8.2 localStorage

```
tc_hr_zone_method      // existant — clé étendue (valeur 'deduced' autorisée en plus)
tc_athlete_hr          // existant — { maxHr, restingHr, aerobicThresholdHr, thresholdHr, birthYear }
tc_hr_zones_custom     // NOUVEAU — cache des 5 zones Personnalisé pour rendu offline
tc_hr_deduced          // NOUVEAU — cache valeurs déduites Strava
                       //   { maxHrObserved, restingHrEstimated, lthrEstimated, computedAt }

// suppression
tc_profile_source      // SUPPRIMÉ
```

### 8.3 API

`PATCH /api/profile` accepte déjà les champs cardio. Étendu pour accepter `hr_zone_method` (text) et `hr_zones_custom` (jsonb). Le bouton « Enregistrer » envoie uniquement les champs requis par la méthode active + la méthode elle-même + le timestamp.

---

## 9. Logique « Déduire automatiquement »

Fichier nouveau : `web/lib/health/hr-deduce.ts`

```ts
export function deduceFromStravaActivities(activities) {
  return {
    maxHrObserved:      Math.max(...activities.map(a => a.max_hr).filter(Boolean)),
    restingHrEstimated: median(activities.map(a => a.min_hr).filter(...)),     // sur 90j
    lthrEstimated:      percentile95(durations_30min_or_more.flatMap(...)),    // p95 FC runs ≥30min
    computedAt:         new Date().toISOString(),
  }
}
```

- Calcul **client-side** la première fois qu'on entre sur la page avec méthode `deduced` ou si le cache est vide / vieux > 7 jours.
- Lecture depuis la **table `activities` Supabase** (déjà synchronisée), **pas d'appel Strava direct**.
- Résultat caché dans `tc_hr_deduced` localStorage.
- Bouton « 🔄 Recalculer » force le recompute.

---

## 10. Persistance entre méthodes

Quand l'utilisateur change de méthode :
- Le nouveau choix est sauvegardé immédiatement en localStorage (`tc_hr_zone_method`).
- Les valeurs **déjà saisies** restent stockées (FC max saisie pour Karvonen reste si on passe à %FC max).
- Le panneau « Sources des valeurs » est mis à jour pour refléter quelle ligne est en gras blanc.
- L'enregistrement Supabase ne se déclenche que quand l'utilisateur clique « Enregistrer ».

---

## 11. Validation avant sauvegarde

Avant `PATCH /api/profile`, vérifier que **tous les champs requis** par la méthode active sont remplis. Sinon, bouton désactivé + message ciblé. Exemples :
- `seuils` sans LTHR → « Renseigne la FC seuil anaérobie / LTHR »
- `auto` sans année → « Renseigne ton année de naissance »
- `custom` avec chevauchement → « Z2 doit commencer après Z1 (151 au lieu de 150) »

---

## 12. Hors scope (à ne PAS faire dans cette refonte)

- Reformulation des libellés des **zones** (Z1 Récupération, Z2 Endurance fondamentale, etc.) — déjà fixés dans `REFERENCE_EFFORT_FC_INTENSITE.md`.
- Modification des **formules de calcul** des zones — inchangées (cf. doc de référence).
- Synchronisation **automatique** Strava → profil (pas de cron, l'utilisateur déclenche).
- Internationalisation — restera en français pour cette v1.
- Modale de calibration (approche C) — rejetée au profit du « tout en ligne ».
