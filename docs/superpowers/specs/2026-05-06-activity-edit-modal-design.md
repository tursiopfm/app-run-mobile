> **Status: Implémenté** · Date: 2026-05-06 · Code: `web/components/ui/EditActivityModal.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Spec : Modal d'édition d'activité (onglet Activités)

**Date :** 2026-05-06  
**Statut :** Approuvé

---

## Contexte

L'onglet Activités affiche une liste de cartes (`ActivityCard`). L'utilisateur veut pouvoir éditer chaque activité via un menu trois points (⋮) qui ouvre un modal full-screen.

Les activités viennent de Strava et sont stockées dans la table Supabase `activities`. Les champs editables doivent survivre aux re-syncs Strava via des colonnes `manual_*` dédiées, sauf le titre qui est mis à jour directement (et peut être écrasé par le prochain sync).

---

## 1. Migration base de données

Ajouter 5 colonnes nullable à la table `activities` :

```sql
ALTER TABLE activities
  ADD COLUMN manual_sport_type       text,
  ADD COLUMN manual_intensity        text,
  ADD COLUMN manual_distance_m       float,
  ADD COLUMN manual_moving_time_sec  integer,
  ADD COLUMN manual_elevation_gain_m float;
```

Le sync Strava (`import-activities.ts`) n'est pas modifié — il n'upserte que les colonnes existantes.

---

## 2. API Routes

### `PATCH /api/activities/[id]`

Body JSON (tous optionnels) :
```ts
{
  name?:                   string
  manual_sport_type?:      string | null
  manual_intensity?:       string | null
  manual_distance_m?:      number | null
  manual_moving_time_sec?: number | null
  manual_elevation_gain_m?:number | null
}
```

- Vérifie que `activities.user_id = auth.uid()` avant update
- Retourne `{ ok: true }` ou erreur

### `DELETE /api/activities/[id]`

- Supprime la ligne dans notre DB uniquement (pas d'appel Strava)
- Vérifie `user_id` avant delete
- Retourne `{ ok: true }` ou erreur

---

## 3. Type `ActivityRow` — extension

```ts
export type ActivityRow = {
  id:                      string
  sport_type:              string
  name:                    string
  start_time:              string
  ces:                     number | null
  distance_m:              number | null
  elevation_gain_m:        number | null
  moving_time_sec:         number | null
  // Override columns (option B)
  manual_sport_type:       string | null
  manual_intensity:        string | null
  manual_distance_m:       number | null
  manual_moving_time_sec:  number | null
  manual_elevation_gain_m: number | null
}
```

La page `activities/page.tsx` ajoute ces champs dans le `.select(...)`.

### Logique de résolution (affichage)

```ts
effectiveSport    = manual_sport_type    ?? sport_type
effectiveDistance = manual_distance_m    ?? distance_m
effectiveDuration = manual_moving_time_sec ?? moving_time_sec
effectiveElevation= manual_elevation_gain_m ?? elevation_gain_m
// intensity : pas de fallback DB, calculé client-side à l'ouverture du modal
```

---

## 4. Composant `ActivityCard` — ajout du bouton ⋮

- Ajouter une prop `onEdit?: (a: ActivityRow) => void`
- Dans le coin haut-droit, à côté du badge `⚡: {ces}`, afficher un bouton `⋮`
- Style : `text-trail-muted`, taille `20px`, `cursor-pointer`, pas de border
- Au clic : appelle `onEdit(activity)`

```
⚡: 87   ⋮
```

---

## 5. Composant `EditActivityModal`

Full-screen overlay `fixed inset-0 z-50 flex flex-col` (même pattern que `SearchPanel`/`FilterPanel`).

### Structure

```
┌─ Header ────────────────────────────────────────────┐
│  ← Modifier l'activité          15/04/2026 · 07:12  │
└─────────────────────────────────────────────────────┘
┌─ Body (overflow-y-auto) ────────────────────────────┐
│                                                     │
│  ┌─ Activité ──────────────────────────────────┐   │
│  │  Titre                                      │   │
│  │  [input text]                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Métriques ─────────────────────────────────┐   │
│  │  Distance (km)    [input]                   │   │
│  │  Durée (hh:mm:ss) [input]                   │   │
│  │  Dénivelé positif (m) [input]               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Sport ─────────────────────────────────────┐   │
│  │  [Running] Trail Marche Randonnée Vélo ...  │   │
│  │  (chips scrollables horizontalement)        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Intensité ─────────────────────────────────┐   │
│  │  [Footing/EF] Sortie longue Côtes VMA ...   │   │
│  │  (chips scrollables horizontalement)        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Footer (dans le flux scrollable) ──────────┐   │
│  │  [Supprimer🔴]  [Annuler]  [Enregistrer🟠]  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Sports disponibles (chips)

| Valeur DB (`sport_type`) | Label affiché |
|---|---|
| `Run` | Running |
| `TrailRun` | Trail |
| `Walk` | Marche |
| `Hike` | Randonnée |
| `Ride` | Vélo |
| `VirtualRide` | Vélo virtuel |
| `EBikeRide` | Vélo électrique |
| `Swim` | Natation |
| `WeightTraining` | Muscu |
| `Workout` | Autre |

### Intensités disponibles (chips)

| Valeur interne | Label affiché |
|---|---|
| `footing` | 🦶 Footing / EF |
| `sortie_longue` | 🐢 Sortie longue |
| `cotes` | ⛰️ Côtes |
| `vma` | 🔥 VMA |
| `seuil` | 🎯 Seuil |
| `runtaf` | 🏢🏃 Runtaf |
| `velotaf` | 🏢🚴 Vélotaf |
| `course` | 🏁 Course |
| `autre` | ❓ Autre |

### Durée — format hh:mm:ss

- Affichage initial : `secondsToHMS(moving_time_sec)` → `"1:22:00"`
- Parsing à la sauvegarde : `hmsToSeconds("1:22:00")` → `4920`
- Validation : regex `^\d+:\d{2}:\d{2}$`

### Boutons footer

```
[Supprimer]   backgroundColor: '#ef4444' (rouge), color: '#fff'
[Annuler]     border: colors.border, color: colors.subtleText, transparent
[Enregistrer] backgroundColor: colors.chargeOrange, color: '#fff'
```

Même `py-3 rounded-[12px] text-[14px] font-bold` que `FilterPanel`.

---

## 6. Détection automatique de l'intensité

Appelée à l'ouverture du modal pour préremplir le chip sélectionné.

Priorité : **mots-clés du titre** → **CES** → **Autres**

```ts
function guessIntensity(name: string, ces: number | null, sport: string): IntensityKey {
  const n = name.toLowerCase()

  if (n.includes('footing') || n.includes(' ef ') || n.includes('endurance facile') || n.includes('récup'))
    return 'footing'
  if (n.includes('sortie longue') || n.includes(' sl ') || n.includes('long run') || n.includes('lsl'))
    return 'sortie_longue'
  if (n.includes('côtes') || n.includes('cotes') || n.includes('cote') || n.includes('montée'))
    return 'cotes'
  if (n.includes('400') || n.includes('200') || n.includes('vma') || n.includes('interval')
      || n.includes('fractionné') || n.includes('répétition'))
    return 'vma'
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold'))
    return 'seuil'
  if (n.includes('runtaf') || n.includes('run taf') || (n.includes('taf') && sport === 'Run'))
    return 'runtaf'
  if (n.includes('vélotaf') || n.includes('velotaf') || n.includes('vélo taf')
      || (n.includes('taf') && (sport === 'Ride' || sport === 'EBikeRide')))
    return 'velotaf'
  if (n.includes('course') || n.includes('compet') || n.includes('race')
      || n.includes('10k') || n.includes('semi') || n.includes('marathon'))
    return 'course'

  // Fallback CES
  if (ces !== null && ces > 120) return 'seuil'
  if (ces !== null && ces >= 70) return 'footing'
  if (ces !== null && ces < 70)  return 'footing'

  return 'autre'
}
```

---

## 7. État et flux dans `ActivitiesClient`

```ts
const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null)
```

- `onEdit(a)` → `setEditingActivity(a)`
- Modal fermeture (Annuler) → `setEditingActivity(null)`
- Enregistrer → PATCH API → optimistic update local de `activities` state → fermer modal
- Supprimer → DELETE API → retirer l'activité du state local → fermer modal

Le state `activities` doit être géré localement dans `ActivitiesClient` (actuellement en prop statique) pour permettre les mises à jour optimistes.

---

## 8. Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `supabase` migration SQL | Créé (5 colonnes `manual_*`) |
| `web/app/api/activities/[id]/route.ts` | Créé (PATCH + DELETE) |
| `web/app/activities/page.tsx` | Modifié (select + manual_* columns) |
| `web/components/ui/ActivityCard.tsx` | Modifié (bouton ⋮ + prop onEdit + résolution manual_*) |
| `web/components/ui/EditActivityModal.tsx` | Créé |
| `web/app/activities/ActivitiesClient.tsx` | Modifié (state local, editingActivity, onEdit, onDelete) |
