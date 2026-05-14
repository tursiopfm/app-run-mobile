> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/components/ui/ActivityFractionneSplits.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Spec : Onglet "Fractionné" — Laps montre dans la page détail activité

**Date :** 2026-05-11  
**Statut :** Approuvé  
**Approche retenue :** A — Minimal, pattern existant

---

## Contexte

La page détail activité (`web/app/(main)/activities/[id]/`) possède actuellement 3 onglets :
- **Splits** : `splits_metric` Strava (km par km), affichage bar chart
- **Zones FC** : distribution FC par zone
- **Stats** : statistiques générales

L'onglet "Splits" affiche les splits métriques (par km). Il doit être conservé tel quel.

Le nouvel onglet **"Fractionné"** affiche les **laps montre** (`laps` dans le DetailedActivity Strava), c'est-à-dire les blocs créés quand l'utilisateur appuie sur LAP (ou par une séance structurée). Ces laps permettent de voir les blocs d'échauffement / travail / récupération d'une séance de fractionné.

---

## Objectif

1. Ajouter un onglet "Fractionné" affichant les laps montre sous forme de tableau.
2. Détecter automatiquement les blocs rapides (allure < médiane des allures).
3. Permettre de copier les temps des blocs rapides (ex. `15:22\n15:30`) pour les coller dans une autre app.

---

## Fichiers modifiés / créés

| Action | Fichier |
|--------|---------|
| Modifier | `web/app/(main)/activities/[id]/page.tsx` |
| Modifier | `web/app/(main)/activities/[id]/ActivityDetailClient.tsx` |
| Modifier | `web/lib/activities/detail.ts` |
| Créer | `web/components/ui/ActivityFractionneSplits.tsx` |

Aucune migration Supabase. Aucune nouvelle route API. Aucune table créée.

---

## Section 1 — Données (page.tsx)

### Source
Les `laps` sont dans l'objet `DetailedActivity` de Strava, retourné par `fetchStravaActivity()`. C'est le même appel API qui fournit déjà `splits_metric`. Zéro appel supplémentaire.

### Extraction
```typescript
const stravaDetail = detail as unknown as {
  splits_metric?: unknown[]
  laps?: unknown[]
  calories?: number
}
// Après extraction de splits_metric existante :
if (Array.isArray(stravaDetail.laps)) {
  laps = stravaDetail.laps as StravaLap[]
  // cache dans raw_payload.laps
}
```

### Cache
Même pattern que `splits_metric` :
- Lire depuis `raw_payload.laps` si déjà présent (évite appel Strava)
- Sinon extraire du détail Strava et sauvegarder dans `raw_payload.laps` via `supabase.update()`

### Propagation
`laps: StravaLap[] | null` passé comme prop à `ActivityDetailClient`.

---

## Section 2 — Types (detail.ts)

Ajout dans `web/lib/activities/detail.ts` :

```typescript
export type StravaLap = {
  id: number
  name: string
  elapsed_time: number          // secondes (temps écoulé)
  moving_time: number           // secondes (temps en mouvement)
  distance: number              // mètres
  average_speed: number         // m/s
  total_elevation_gain: number  // mètres (toujours >= 0)
  lap_index: number             // index 0-based
  split: number                 // numéro 1-based affiché
  average_heartrate?: number    // bpm (optionnel)
  max_heartrate?: number        // bpm (optionnel)
  pace_zone?: number            // zone Strava (optionnel)
}
```

---

## Section 3 — Tab (ActivityDetailClient.tsx)

### Type Tab étendu
```typescript
type Tab = 'splits' | 'fractionne' | 'zones' | 'stats'
```

### Condition d'affichage
```typescript
const showFractionne = laps !== null && laps.length >= 2
```
(1 seul lap = pas de séance structurée = onglet masqué)

### Ordre des onglets
**Splits · Fractionné · Zones FC · Stats**

### Onglet par défaut
```typescript
const [activeTab, setActiveTab] = useState<Tab>(
  showSplits ? 'splits' : showFractionne ? 'fractionne' : showZones ? 'zones' : 'stats'
)
```

---

## Section 4 — Composant ActivityFractionneSplits

**Fichier :** `web/components/ui/ActivityFractionneSplits.tsx`

### Props
```typescript
type Props = {
  laps: StravaLap[]
}
```

### Tableau affiché

Colonnes : **#** · **Distance** · **Temps** · **Allure** · **D+**

| Colonne | Source | Format |
|---------|--------|--------|
| # | `split` | `1`, `2`, ... |
| Distance | `distance` | `3,36 km` ou `220 m` si < 1000m |
| Temps | `moving_time` | `mm:ss` ou `h:mm:ss` |
| Allure | `1000 / average_speed` | `mm:ss/km` |
| D+ | `total_elevation_gain` | `+8 m` si > 0, sinon vide |

**Note :** `total_elevation_gain` dans les laps Strava est toujours ≥ 0 (dénivelé positif uniquement, contrairement à `elevation_difference` dans `splits_metric`). La colonne est donc D+ uniquement.

### Détection des blocs rapides

1. Calculer l'allure de chaque lap : `pace_s = 1000 / average_speed` si `average_speed > 0`
2. Filtrer les laps valides pour la médiane : laps avec `distance >= 100` m et `average_speed > 0`
3. Calculer la médiane des allures des laps valides
4. Un lap est "rapide" si `pace_s < médiane × 0,95`
5. Les laps rapides reçoivent une mise en évidence visuelle (fond coloré + badge "Rapide")

**Justification du seuil 0,95 (5% plus rapide que la médiane) :**
- Sur l'exemple utilisateur : médiane ≈ 353s/km, seuil = 335s/km, laps rapides = 299 et 302s/km → détection correcte
- Robuste aux récupérations très lentes (lap 0.22km à 13:45/km) car la médiane les absorbe sans être tirée vers le haut

### Bouton "Copier les temps rapides"

- Affiche les `moving_time` des laps rapides, formatés `mm:ss`, un par ligne
- `navigator.clipboard.writeText(text)` avec fallback message d'erreur
- Feedback "Copié !" pendant 2s (state local `copied`)
- Bouton désactivé + texte "Aucun bloc rapide" si aucun lap rapide détecté

**Format copié (exemple) :**
```
15:22
15:30
```

### États

| État | Affichage |
|------|-----------|
| Laps présents | Tableau + bouton copie |
| Aucun lap rapide détecté | Tableau visible, bouton désactivé "Aucun bloc rapide" |
| `laps` vide ou null | L'onglet est masqué (non rendu) |
| Erreur clipboard | Message "Impossible de copier" |

---

## Section 5 — Tests

### Cas à couvrir

| Test | Entrée | Résultat attendu |
|------|--------|-----------------|
| Formatage allure | `average_speed = 3.36` m/s | `4:57/km` |
| Formatage temps | `moving_time = 922` s | `15:22` |
| Détection blocs rapides | Laps échauff / rapide / repos / rapide / récup | Laps 2 et 4 détectés |
| Médiane avec outlier | Lap 0.22km à 13:45/km inclus | Médiane non faussée |
| Aucun bloc rapide | Laps tous à allure similaire | Bouton désactivé |
| Lap sans vitesse | `average_speed = 0` | Ignoré dans détection et affichage allure = `—` |
| Activité 1 seul lap | `laps.length === 1` | Onglet masqué |
| Activité sans laps | `laps = null` | Onglet masqué |
| Copie contenu | Laps 2 et 4 rapides | `"15:22\n15:30"` |

---

## Contraintes et limites connues

- `total_elevation_gain` dans les laps Strava = dénivelé montée uniquement (pas différence nette). Affiché `+X m`. La différence d'altitude nette (comme dans `splits_metric.elevation_difference`) n'est pas disponible dans les laps.
- Fréquence cardiaque par lap (`average_heartrate`) affichée uniquement si présente dans le payload Strava.
- Strava ne garantit pas que tous les détails d'activité ont des laps structurés — beaucoup d'activités auront 1 seul lap (onglet masqué dans ce cas).
- Les laps `split` et `lap_index` peuvent différer selon la version de l'API. On utilise `split` (1-based) pour l'affichage.

---

## Non-régression

- L'onglet "Splits" (splits_metric, bar chart) est inchangé.
- L'onglet "Zones FC" est inchangé.
- L'onglet "Stats" est inchangé.
- Une activité sans laps ou avec 1 seul lap ne fait pas apparaître l'onglet "Fractionné".
- Le cache `raw_payload.laps` ne remplace pas `raw_payload.splits_metric`.
