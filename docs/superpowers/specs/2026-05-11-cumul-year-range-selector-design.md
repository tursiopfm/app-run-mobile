> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/components/cockpit/CumulBlock.tsx`, `web/components/cockpit/YearRangeSelector.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Sélecteur d'années pour le bloc Cumul km/année

**Date** : 2026-05-11
**Bloc concerné** : `CumulBlock` (onglet Cockpit, vue Année)
**Statut** : design approuvé, prêt pour planification

## Contexte

Le bloc « Cumul km/année » affiche désormais l'historique complet (jusqu'à 14 années dans le cas de Franck). Avec autant de courbes, la lecture devient dense. Un contrôle est nécessaire pour ajuster le nombre d'années visibles, sans renoncer à la possibilité d'afficher tout l'historique.

## Objectif

Ajouter un sélecteur permettant de choisir combien d'années récentes afficher sur le graphe, avec :
- Accès rapide aux valeurs fréquentes (3, 5, 10 ans, tout)
- Grain fin pour toute valeur intermédiaire
- Persistance entre sessions

## Architecture

### Filtrage côté client

`dashboard.ts:buildCumulYears` continue de retourner **toutes** les années qui ont au moins une activité. Le filtrage par fenêtre temporelle se fait dans `CumulBlock` au moment du render : `sov.cumulYears.slice(-yearWindow)`.

Pourquoi côté client :
- Le drag du slider met à jour le graphe en live sans round-trip serveur
- Pas de re-fetch nécessaire quand l'utilisateur change la valeur

### Nouveau composant : `YearRangeSelector`

Fichier : `web/components/cockpit/YearRangeSelector.tsx`

Props :
```ts
type Props = {
  value:    number             // nombre d'années actuellement affichées
  max:      number             // maxYears disponibles (>= 1)
  onChange: (n: number) => void
  accent?:  string             // couleur du thumb/preset actif, défaut #38BDF8
}
```

Le composant est purement contrôlé (pas d'état interne au-delà du transient drag). `CumulBlock` détient la source de vérité.

### Modifications de `CumulBlock`

- Étendre le type `Settings` :
  ```ts
  type Settings = {
    visible:    SportKey[]
    default:    SportKey
    yearWindow: number   // nouveau
  }
  ```
- Défaut : `yearWindow: 5`
- Persistance : extension de la clé existante `cockpit_cumul_settings` dans `localStorage`
- Rendu conditionnel : `<YearRangeSelector>` apparaît uniquement si `period === 'year'` et `maxYears > 1`
- Slice : avant de passer la série au chart et à la légende, appliquer `series.slice(-settings.yearWindow)`

### Pas de modif sur `CockpitCumulChart`

Le chart reçoit déjà un `MonthSeries[]` de longueur variable et n'a pas connaissance de la fenêtre choisie.

## Comportement

### Slider

- Range : `1 → maxYears`
- Pas : 1
- Thumb : cercle 14px, fond `#38BDF8`, bordure 2px `white/20`
- Track : 2px de haut, `bg-trail-border` ; track rempli en `bg-[#38BDF8]`
- Zone tactile : padding invisible autour du thumb pour atteindre ~32px (touch-friendly mobile)
- Live update : changement déclenché sur `input` (pas `change`), donc le graphe se met à jour pendant le drag

### Presets

Quatre pilules (3A / 5A / 10A / Tout) à gauche du slider :
- Style identique aux pilules Mois/Année existantes : `rounded-full px-2 py-0.5 text-[11px]`, bordure 1px
- État actif (valeur courante matche) : fond `#38BDF8`, texte blanc
- État inactif : fond transparent, contour `colors.border`, texte `colors.subtleText`
- État disabled (preset > maxYears) : opacité 0.4, non-cliquable
- `Tout` mappe à `maxYears`, jamais disabled

### Compteur

À droite du strip : `« N années »` en `text-[11px] text-trail-muted`. Mis à jour en temps réel pendant le drag.

### Filtrage visuel

Les années en dehors de la fenêtre sont **masquées** :
- Pas de ligne sur le chart
- Pas d'entrée dans la légende sous le chart

Les couleurs des années restantes ne changent pas (la palette est indexée sur l'offset depuis l'année courante, défini dans `dashboard.ts`).

### Mode Mois

Le selector est caché en mode Mois. La valeur `yearWindow` reste persistée et restaurée au retour en mode Année.

## Persistance et edge cases

### Schéma `localStorage`

Clé : `cockpit_cumul_settings`

```json
{
  "visible":    ["run", "ride", "swim", "all"],
  "default":    "run",
  "yearWindow": 5
}
```

Migration : si l'objet existe sans `yearWindow`, fallback sur le défaut (5). Pas de migration explicite nécessaire — `DEFAULT_SETTINGS` est merge avec le contenu parsed.

### Cas limites

| Cas | Comportement |
|---|---|
| `maxYears === 0` | Bloc déjà vide (« Aucune donnée ») — selector non rendu |
| `maxYears === 1` | Selector entièrement masqué (pas de choix possible) |
| `yearWindow > maxYears` (ex. import a perdu des activités) | Clamp à `maxYears` au render, et écrit la valeur clampée dans `localStorage` |
| `yearWindow < 1` (corruption localStorage) | Clamp à 1 |
| Preset `10A` quand `maxYears === 7` | Pilule grisée, non-cliquable |

## Styling

Cohérence avec le style existant du bloc :
- Strip à hauteur ~32px, `mt-[10px]` après la légende
- Layout horizontal : `[presets] ─── [slider flex-1] ─── [compteur]`
- Sur mobile (< 380px), les presets passent en wrap sous le slider si nécessaire
- Couleur accent : `#38BDF8` (sky blue), identique à la couleur de l'année courante dans `YEAR_COLOR_PALETTE`

## Test plan

- Vue Année avec 14 années en base : selector visible, défaut 5 années, lignes 2022→2026 affichées
- Drag slider de 5 → 14 : graphe se met à jour live, légende suit, compteur passe à « 14 années »
- Tap preset `10A` : slider snap à 10, pilule `10A` devient active
- Tap preset `Tout` quand `maxYears=14` : slider snap à 14, pilule `Tout` active
- Switch Mois → Année : selector réapparaît avec la dernière valeur
- Reload page : valeur persistée restaurée
- User avec 2 ans d'historique : presets `3A`, `5A`, `10A` disabled, slider range 1→2
- User avec 0 activité : aucun rendu (déjà géré par le composant)

## Non-objectifs

- Pas de range slider (year_start, year_end) — fenêtre fixée à « N dernières années »
- Pas de configuration par sport — la fenêtre est globale
- Pas d'animation de transition des lignes — apparition/disparition instantanée (Recharts gère)
- Pas d'export ou de zoom sur le graphe — séparé du scope
