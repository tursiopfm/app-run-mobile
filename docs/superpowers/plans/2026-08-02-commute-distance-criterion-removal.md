# Suppression du critère de distance du matching TAF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le matching TAF ne dépend plus de la distance : sport + points GPS départ/arrivée (± tolérance géo) suffisent, et la tolérance km disparaît de l'UI des trajets.

**Architecture:** Deux unités : (1) la fonction pure `matchCommute` (`web/lib/activities/commute.ts`) perd son filtre distance, en TDD ; (2) l'UI `CommuteRoutesSection.tsx` perd le champ « Tol. dist. % » (2 formulaires) et l'affichage « réf X km · ±Y % », plus les Drift notes sur la spec du 2026-08-01. Spec : `docs/superpowers/specs/2026-08-02-commute-distance-criterion-removal-design.md`.

**Tech Stack:** Next.js 14 / TypeScript, Jest.

## Global Constraints

- Branche de travail : `fix/commute-remove-distance` (depuis `master`). **Gate bloquant avant chaque commit** : `[ "$(git rev-parse --abbrev-ref HEAD)" = "fix/commute-remove-distance" ]` sinon ABORT.
- Les subagents n'exécutent **JAMAIS** de commande git — le contrôleur commite.
- Jamais de `git push` sans demande explicite de Franck.
- Jest/npm : toujours `cd /c/Users/Franc/app-run-mobile/web` d'abord ; git : `git -C /c/Users/Franc/app-run-mobile`. Ne lancer que les suites pertinentes (échecs i18n pré-existants).
- Vérif locale via `npx tsc --noEmit` + `npm run lint` (build local non autoritatif sur Windows).
- **Aucune migration, aucun changement d'API** : `ref_distance_m` (NOT NULL, toujours écrite à la création) et `distance_tol_pct` restent en base ; POST/PATCH acceptent toujours `distanceTolPct`, l'UI ne l'envoie plus.
- Inchangés : `resolveDirection`, fallback heure, `matchCommuteByTitle`, `extractCommuteGeo` (dont `distanceM`, utilisé par la création de trajet), champ « Tol. géo m », éditeur de points.
- UI en français ; aucune couleur en dur.

---

### Task 1: `matchCommute` sans critère de distance (TDD)

**Files:**
- Modify: `web/lib/activities/commute.ts:86-110` (JSDoc + boucle de `matchCommute`)
- Test: `web/__tests__/activities/commute.test.ts` (1 test remplacé, 1 ajouté)

**Interfaces:**
- Consumes: rien.
- Produces: signature publique **inchangée** — `matchCommute(input: { sportType: string; geo: CommuteGeo }, routes: CommuteRoute[]): CommuteMatch | null`. Les champs `refDistanceM`/`distanceTolPct` restent dans le type `CommuteRoute` (API/DB inchangées) mais ne sont plus lus par le matching.

- [ ] **Step 0: Créer la branche (contrôleur)**

```bash
git -C /c/Users/Franc/app-run-mobile checkout -b fix/commute-remove-distance master
```

- [ ] **Step 1: Modifier les tests (1 remplacé, 1 ajouté) et vérifier qu'ils échouent**

Dans `web/__tests__/activities/commute.test.ts`, `describe('matchCommute')` :

a) **Remplacer** le test existant :

```ts
  it('distance hors tolérance → null', () => {
    const geo = extractCommuteGeo({
      distance: 9000, // +80% > 12%
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })
```

par :

```ts
  it('distance très différente de la réf mais départ/arrivée corrects → match', () => {
    // La distance n'est plus un critère : les points font foi (décision 2026-08-02).
    const geo = extractCommuteGeo({
      distance: 9000, // réf 5000 — l'ancienne tolérance ±12 % aurait rejeté
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    const m = matchCommute({ sportType: 'Run', geo }, [makeRoute()])
    expect(m?.direction).toBe('outbound')
  })
```

b) **Ajouter** juste après :

```ts
  it('activité sans distance mais GPS départ/arrivée valides → match', () => {
    const geo = extractCommuteGeo({
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    const m = matchCommute({ sportType: 'Run', geo }, [makeRoute()])
    expect(m?.direction).toBe('outbound')
  })
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts -t "distance"`
Attendu : **2 FAIL** — les deux tests reçoivent `null` au lieu d'`outbound` (le filtre distance actuel rejette 9000 m hors tolérance, et court-circuite quand `distanceM` est absent). Si l'un des deux ne FAIL pas, s'arrêter et investiguer.

- [ ] **Step 3: Implémenter**

Dans `web/lib/activities/commute.ts`, remplacer la JSDoc et la boucle de `matchCommute` (lignes ~86-110) :

```ts
/**
 * Détecte si une activité correspond à un trajet domicile-travail et dans quel sens.
 * Critères : sport + géo stricte départ ET arrivée (routes avec Home/Office),
 * quelle que soit la distance ; heure en secours pour les routes héritées
 * sans points GPS.
 */
export function matchCommute(
  input: { sportType: string; geo: CommuteGeo },
  routes: CommuteRoute[],
): CommuteMatch | null {
  for (const route of routes) {
    if (!route.active) continue
    if (route.sportType.toLowerCase() !== input.sportType.toLowerCase()) continue

    const direction = resolveDirection(input.geo, route)
    if (direction == null) continue

    return { route, direction }
  }
  return null
}
```

(Disparaissent : le `const { geo } = input`, le commentaire « Distance requise et dans la tolérance », le `continue` sur `geo.distanceM == null` et le calcul de `tol`.)

- [ ] **Step 4: Vérifier que toute la suite passe**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts`
Attendu : PASS complet (41 tests). Les tests boucles/arrivée manquante/fallback heure/titre/vélotaf ne dépendent pas du filtre distance.

- [ ] **Step 5: tsc**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Attendu : silencieux (aucun consommateur du filtre supprimé).

- [ ] **Step 6: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "fix/commute-remove-distance" ] \
  && git -C /c/Users/Franc/app-run-mobile add web/lib/activities/commute.ts web/__tests__/activities/commute.test.ts \
  && git -C /c/Users/Franc/app-run-mobile commit -m "feat(commute): les points GPS font foi — la distance n'est plus un critère TAF" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

### Task 2: UI sans tolérance km + Drift notes + bandeau spec

**Files:**
- Modify: `web/components/settings/CommuteRoutesSection.tsx` (RouteCard : sous-titre l.321-323, états l.291, saveEdit l.294-302, cancelEdit l.304-310, grille l.390-399 ; AddRouteForm : état l.452, reset l.482, POST l.504, grille l.632-643, texte d'aide l.567-570)
- Modify: `docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md` (ajout `## Drift notes` en fin de fichier)
- Modify: `docs/superpowers/specs/2026-08-02-commute-distance-criterion-removal-design.md` (bandeau Status)

**Interfaces:**
- Consumes: rien de Task 1 (indépendante).
- Produces: rien. Le type local `CommuteRoute` du composant **garde** `refDistanceM`/`distanceTolPct` (payload API inchangé) ; `formatKm` reste (liste des activités candidates l.562).

- [ ] **Step 1: Éditer `RouteCard`**

Dans `web/components/settings/CommuteRoutesSection.tsx` :

1. Sous-titre de la carte — remplacer :
```tsx
          <p className="text-micro text-trail-muted">
            {route.sportType} · réf {formatKm(route.refDistanceM)} · ±{route.distanceTolPct}%
          </p>
```
par :
```tsx
          <p className="text-micro text-trail-muted">{route.sportType}</p>
```
2. Supprimer l'état `const [distTol, setDistTol] = useState(route.distanceTolPct)`.
3. Dans `saveEdit()`, supprimer la ligne `distanceTolPct: distTol,`.
4. Dans `cancelEdit()`, supprimer la ligne `setDistTol(route.distanceTolPct)`.
5. Remplacer la grille d'édition :
```tsx
          <div className="grid grid-cols-2 gap-[8px]">
            <div>
              <FieldLabel>Tol. dist. %</FieldLabel>
              <NumberInput value={distTol} onChange={setDistTol} />
            </div>
            <div>
              <FieldLabel>Tol. géo m</FieldLabel>
              <NumberInput value={geoTol} onChange={setGeoTol} />
            </div>
          </div>
```
par :
```tsx
          <div>
            <FieldLabel>Tol. géo m</FieldLabel>
            <NumberInput value={geoTol} onChange={setGeoTol} />
          </div>
```

- [ ] **Step 2: Éditer `AddRouteForm`**

1. Supprimer l'état `const [distanceTolPct, setDistanceTolPct] = useState(12)`.
2. Dans `reset()`, supprimer `setDistanceTolPct(12)`.
3. Dans le corps du POST (`body: JSON.stringify({...})`), supprimer la ligne `distanceTolPct,`.
4. Remplacer la grille des options avancées :
```tsx
          <div className="grid grid-cols-2 gap-[8px] mt-[8px]">
            <div>
              <FieldLabel>Tol. dist. %</FieldLabel>
              <NumberInput value={distanceTolPct} onChange={setDistanceTolPct} />
            </div>
            <div>
              <FieldLabel>Tol. géo m</FieldLabel>
              <NumberInput value={geoTolM} onChange={setGeoTolM} />
            </div>
          </div>
```
par :
```tsx
          <div className="mt-[8px]">
            <FieldLabel>Tol. géo m</FieldLabel>
            <NumberInput value={geoTolM} onChange={setGeoTolM} />
          </div>
```
5. Texte d'aide de l'activité de référence — remplacer :
```tsx
        <p className="text-[10px] text-trail-muted/80 mt-[4px] leading-[14px]">
          C&apos;est l&apos;ALLER qui sert de référence : la distance et les points Home (départ) / Office
          (arrivée) en sont extraits. Le retour (trajet inverse) est détecté automatiquement.
        </p>
```
par :
```tsx
        <p className="text-[10px] text-trail-muted/80 mt-[4px] leading-[14px]">
          C&apos;est l&apos;ALLER qui sert de référence : les points Home (départ) / Office (arrivée)
          en sont extraits. Le retour (trajet inverse) est détecté automatiquement.
        </p>
```

- [ ] **Step 3: Vérifier**

```bash
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit
cd /c/Users/Franc/app-run-mobile/web && npm run lint
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts
```

Attendu : tsc silencieux (aucune référence orpheline à `distTol`/`distanceTolPct` dans le composant — le champ du TYPE reste, c'est normal), lint sans NOUVEAU warning, suite commute verte.

- [ ] **Step 4: Drift notes + bandeau**

a) En **fin** de `docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md`, ajouter :

```markdown

## Drift notes

- 2026-08-02 : le « filtre distance (réf ± `distance_tol_pct` %) en garde
  amont » décrit ci-dessus a été **supprimé** — les points départ/arrivée font
  foi quelle que soit la distance. Voir
  `2026-08-02-commute-distance-criterion-removal-design.md`.
```

b) Dans `docs/superpowers/specs/2026-08-02-commute-distance-criterion-removal-design.md`, remplacer :

```markdown
**Statut** : Spec validée, en attente d'implémentation
```

par :

```markdown
> **Status: Implémenté** · 2026-08-02 · Code: `web/lib/activities/commute.ts` (matchCommute), `web/components/settings/CommuteRoutesSection.tsx`
```

- [ ] **Step 5: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "fix/commute-remove-distance" ] \
  && git -C /c/Users/Franc/app-run-mobile add web/components/settings/CommuteRoutesSection.tsx docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md docs/superpowers/specs/2026-08-02-commute-distance-criterion-removal-design.md docs/superpowers/plans/2026-08-02-commute-distance-criterion-removal.md \
  && git -C /c/Users/Franc/app-run-mobile commit -m "chore(settings): retire la tolérance de distance de l'UI des trajets" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

## Après exécution

- Merge/push : **uniquement sur demande explicite de Franck**. Utiliser superpowers:finishing-a-development-branch.
- Vérif manuelle Franck après déploiement : une variante longue de son TAF (hors ancienne fourchette ±12 %) est détectée ; une boucle depuis chez lui ne l'est toujours pas ; l'UI des trajets n'affiche plus ni « réf X km · ±Y % » ni « Tol. dist. % ».
