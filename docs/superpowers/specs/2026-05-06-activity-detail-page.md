> **Status: Implémenté** · Date: 2026-05-06 · Code: `web/app/(main)/activities/[id]/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Spec — Page Détail Activité

Date: 2026-05-06  
Status: Approuvé

## Résumé

Nouvelle page `/activities/[id]` affichant le détail complet d'une activité : carte de la route, métriques clés, splits par km et zones de fréquence cardiaque.

---

## Design approuvé

**Hybride A + C** (mockup `activity-hybrid-v2.html`) :

1. Carte immersive plein-largeur avec route lumineuse (dégradé vert→orange)
2. Badge sport + intensité + badge "Effort" (remplace CES)
3. Nom de l'activité + date
4. Grille 6 tuiles de stats toujours visibles
5. Onglets **Splits | Zones FC** pour le contenu détaillé
6. Page scrollable verticalement

---

## Route

```
/activities/[id]        → app/activities/[id]/page.tsx  (Server Component)
```

Navigation : clic sur `ActivityCard` dans `/activities` → push vers `/activities/[id]`.

---

## Architecture des composants

```
app/activities/[id]/
  page.tsx                     ← Server Component : fetch DB + raw_payload
  ActivityDetailClient.tsx     ← Client Component : tabs, scroll, interactions

components/ui/
  ActivityMap.tsx              ← Carte Leaflet avec polyline décodée
  ActivitySplits.tsx           ← Onglet Splits
  ActivityHeartRateZones.tsx   ← Onglet Zones FC
```

---

## Données

### Champs existants en DB (`activities` table)

Tous disponibles sans appel Strava supplémentaire :

| Champ DB | Affiché |
|---|---|
| `name` | Nom activité |
| `sport_type` + `manual_sport_type` | Badge sport |
| `start_time` | Date · heure |
| `distance_m` / `manual_distance_m` | Distance km |
| `elevation_gain_m` / `manual_elevation_gain_m` | D+ |
| `moving_time_sec` / `manual_moving_time_sec` | Durée |
| `duration_sec` | Temps écoulé |
| `calories` | Calories |
| `avg_hr` / `max_hr` | FC moy / FC max |
| `ces` | Score Effort |
| `manual_intensity` | Intensité (emoji) |
| `raw_payload` (JSONB) | Polyline + splits |

### Extraction depuis `raw_payload`

Le `raw_payload` stocke la réponse Strava brute. Pour les activités importées depuis la liste Strava (`/athlete/activities`), il contient :

- `map.summary_polyline` — polyline encodée (présente dans la liste)
- **`splits_metric` — absent** de la liste Strava, présent uniquement dans le détail `/activities/{id}`

**Stratégie splits : fetch on-demand depuis Strava**

Au chargement de la page détail (`page.tsx`, server-side), si `raw_payload.splits_metric` est absent :
1. Récupérer le token Strava via `getValidStravaToken(userId)` (pattern existant dans `StravaRepository`)
2. Appel `fetchStravaActivity(accessToken, providerActivityId)` (fonction existante dans `lib/providers/strava/api.ts`)
3. Merge dans `raw_payload` : `UPDATE activities SET raw_payload = raw_payload || '{"splits_metric": [...]}' WHERE id = $1` (jsonb merge Supabase)
4. Passer `splits_metric` au Client Component

Si les splits sont déjà en `raw_payload.splits_metric` : aucun appel réseau.  
Si le fetch échoue (token expiré, rate limit) : onglet Splits masqué, pas d'erreur bloquante.  
Pour les activités non-Strava (`provider ≠ 'strava'`) : onglet Splits masqué.

### Zones FC

Calculées côté client à partir de `max_hr` de l'activité (champ DB) et de **5 zones standard** (pourcentages du max HR) :

| Zone | % max HR | Label |
|---|---|---|
| Z1 | < 60% | Récupération |
| Z2 | 60–70% | Aérobie |
| Z3 | 70–80% | Tempo |
| Z4 | 80–90% | Seuil |
| Z5 | > 90% | VO2max |

La durée par zone est **estimée** en redistribuant `moving_time_sec` proportionnellement à la distance entre `avg_hr` et `max_hr` — approximation acceptable en l'absence de données FC granulaires. Si `avg_hr` ou `max_hr` est null : onglet Zones FC masqué.

> Itération future : stocker le stream FC dans `raw_payload` pour une répartition exacte.

---

## Composant Carte (`ActivityMap`)

- **Librairie** : Leaflet via `react-leaflet` (tiles OpenStreetMap, cohérent avec l'app Android)
- **Polyline** : décodée avec `@mapbox/polyline` depuis `raw_payload.map.summary_polyline`
- **Style** : fond de carte sombre (`CartoDB.DarkMatter`), route en `#e8651a` avec opacité 0.9
- **Markers** : point de départ vert, point d'arrivée orange
- **Fallback** : si pas de polyline → placeholder gris avec message "Carte non disponible"
- **Rendu** : dynamique (import `next/dynamic` avec `ssr: false`)

---

## Layout détaillé

```
┌─────────────────────────────┐
│  ← (back)       [✏️ edit]   │  ← boutons flottants z-50
│                             │
│      CARTE (230px)          │  ← Leaflet, route lumineuse
│                             │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │  ← dégradé fondu
├─────────────────────────────┤
│  [Course] 🦶    ⚡ Effort 68 │
│  Course à pied matinale     │
│  29 avril 2026 · 09:21      │
├─────────────────────────────┤
│  Distance  D+    Durée      │  ← grille 3×2
│  11.4 km  974m  2h02        │  ← toujours visible
│  Allure   Cal.  Tps écoulé  │
│  10:48   1981   2h04        │
├─────────────────────────────┤
│  [ Splits ]  [ Zones FC ]   │  ← onglets sticky
├─────────────────────────────┤
│  ▸ Splits : 12 lignes       │  ← scrollable
│    km | barre | allure | D  │
│  ▸ Zones FC : 5 barres      │
│    + FC moy / FC max        │
└─────────────────────────────┘
```

---

## Couleurs des splits

Barre et allure colorées selon l'écart à l'allure moyenne :

| Écart | Couleur |
|---|---|
| ≤ −10% (plus rapide) | `#4caf50` vert |
| −10% à 0% | `#8bc34a` vert clair |
| 0% à +10% | `#ffb300` jaune |
| +10% à +20% | `#ff7043` orange |
| > +20% (très lent) | `#e8651a` rouge |

---

## Navigation

- **Entrée** : `ActivityCard` dans `ActivitiesClient.tsx` — clic sur la card (hors bouton ⋮) → `router.push('/activities/' + a.id)`
- **Retour** : bouton `←` flottant → `router.back()`
- **Édition** : bouton `✏️` flottant → ouvre `EditActivityModal` (composant existant dans `components/ui/EditActivityModal.tsx`, importé directement dans `ActivityDetailClient.tsx`). Après sauvegarde : `router.refresh()` pour recharger les données depuis le Server Component.

---

## Gestion des données manquantes

| Donnée | Si absente |
|---|---|
| `summary_polyline` | Placeholder carte |
| `splits_metric` | Fetch Strava → si erreur : onglet Splits masqué |
| `avg_hr` / `max_hr` | Onglet Zones FC masqué |
| `calories` | Affiche `—` |
| `elevation_gain_m` | Affiche `—` |

---

## Nouvelles dépendances

```
react-leaflet        ← rendu carte
leaflet              ← moteur carte
@mapbox/polyline     ← décodage polyline Strava
@types/leaflet       ← types TS
```

---

## Ce qui n'est PAS dans ce spec

- Graphique d'élévation (prévu pour une itération suivante)
- Partage d'activité
- Commentaires / kudos Strava
- Export GPX
