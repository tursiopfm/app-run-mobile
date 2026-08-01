# Détection TAF départ + arrivée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une activité n'est classée trajet TAF (Runtaf/Vélotaf) que si elle part d'un des deux points GPS du trajet ET arrive à l'autre ; le champ « Bascule h » sans effet disparaît de l'UI.

**Architecture:** Le durcissement tient dans la fonction pure `resolveDirection` de `web/lib/activities/commute.ts` (logique commune à toutes les routes, tous sports). Le retrait UI se fait dans `web/components/settings/CommuteRoutesSection.tsx`. Aucune migration, aucun changement d'API : la colonne `hour_split` et le champ API restent (fallback des routes héritées sans géo).

**Tech Stack:** Next.js 14 / TypeScript, Jest. Spec : `docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md`.

## Global Constraints

- Branche de travail : `fix/commute-endpoint-matching` (depuis `master`). **Gate bloquant avant chaque commit** : `[ "$(git rev-parse --abbrev-ref HEAD)" = "fix/commute-endpoint-matching" ]` sinon ABORT (leçon 2026-06-12 : sessions concurrentes possibles → si activité concurrente visible dans `git log`, passer en worktree isolé via superpowers:using-git-worktrees, avec jonction `web/node_modules`).
- Les subagents n'exécutent **JAMAIS** de commande git (ni add, ni commit, ni checkout/push) — le contrôleur commite (leçon 2026-06-05).
- Jamais de `git push` ni de déploiement sans demande explicite de Franck.
- Jest/npm : toujours `cd /c/Users/Franc/app-run-mobile/web` d'abord (cwd Bash non fiable) ; git : `git -C /c/Users/Franc/app-run-mobile`.
- `npm run build` local non autoritatif sur Windows : vérifier via `npx tsc --noEmit` + `npm run lint`.
- Ne lancer que les suites Jest pertinentes (~50 tests i18n échouent en pré-existant, hors périmètre).
- Aucune migration Supabase, aucun fichier SW touché.
- UI en français ; aucune couleur en dur (pas de changement de style ici de toute façon).

---

### Task 1: Durcir `resolveDirection` — arrivée vérifiée (TDD)

**Files:**
- Modify: `web/lib/activities/commute.ts:86-136` (JSDoc de `matchCommute` + `resolveDirection`)
- Test: `web/__tests__/activities/commute.test.ts` (ajouts dans `describe('matchCommute')`, après le test « distance hors tolérance → null »)

**Interfaces:**
- Consumes: rien (fonctions pures existantes : `matchCommute`, `extractCommuteGeo`, `haversineMeters`, helper de test `makeRoute`).
- Produces: signature publique **inchangée** — `matchCommute(input: { sportType: string; geo: CommuteGeo }, routes: CommuteRoute[]): CommuteMatch | null`. `resolveDirection` reste privée. Aucun autre fichier à adapter (Task 2 est indépendante).

- [ ] **Step 0: Créer la branche**

```bash
git -C /c/Users/Franc/app-run-mobile checkout -b fix/commute-endpoint-matching master
```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `web/__tests__/activities/commute.test.ts`, à l'intérieur de `describe('matchCommute', …)`, insérer après le test `'distance hors tolérance → null'` (ligne ~130) :

```ts
  it('régression : boucle depuis Home (arrivée = Home) → null', () => {
    // Le faux positif d'origine : footing de la bonne distance qui part de
    // chez soi et y revient — l'arrivée n'est pas le bureau, pas un trajet.
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8566, 2.3522], // Home
      end_latlng: [48.8567, 2.3524], // ~20 m de Home
      start_date_local: '2026-05-28T07:45:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })

  it('boucle depuis Office (arrivée = Office) → null', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8606, 2.42], // Office
      end_latlng: [48.8607, 2.4202], // ~20 m d'Office
      start_date_local: '2026-05-28T12:10:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })

  it('route avec géo + arrivée GPS manquante → null', () => {
    // Départ valide à Home mais pas d'end_latlng (montre coupée) :
    // sans preuve d'arrivée, pas de classement auto (le titre reste la voie
    // de rattrapage manuelle).
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8566, 2.3522], // Home
      end_latlng: [],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    expect(matchCommute({ sportType: 'Run', geo }, [makeRoute()])).toBeNull()
  })

  it('vélotaf : même logique départ+arrivée pour une route Ride', () => {
    const geo = extractCommuteGeo({
      distance: 5000,
      start_latlng: [48.8566, 2.3522],
      end_latlng: [48.8606, 2.42],
      start_date_local: '2026-05-28T07:45:00Z',
    })
    const m = matchCommute(
      { sportType: 'Ride', geo },
      [makeRoute({ sportType: 'Ride', label: 'Vélotaf' })],
    )
    expect(m?.direction).toBe('outbound')
  })
```

- [ ] **Step 2: Vérifier qu'ils échouent (les 3 premiers)**

```bash
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts -t "boucle"
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts -t "arrivée GPS manquante"
```

Attendu : **3 FAIL** — « boucle depuis Home » reçoit `outbound` au lieu de `null`, « boucle depuis Office » reçoit `return`, « arrivée GPS manquante » reçoit `outbound` (le code actuel ne regarde que le départ). Le test vélotaf, lui, passe déjà (garde de non-régression). Si l'un des 3 ne FAIL pas, s'arrêter et investiguer avant d'implémenter.

- [ ] **Step 3: Implémenter le durcissement**

Dans `web/lib/activities/commute.ts`, remplacer la JSDoc de `matchCommute` (lignes 86-89) :

```ts
/**
 * Détecte si une activité correspond à un trajet domicile-travail et dans quel sens.
 * Direction : géo stricte départ ET arrivée (routes avec Home/Office),
 * heure en secours pour les routes héritées sans points GPS.
 */
```

Et remplacer intégralement `resolveDirection` (lignes 112-136) par :

```ts
function resolveDirection(geo: CommuteGeo, route: CommuteRoute): CommuteDirection | null {
  const routeHasGeo =
    route.homeLat != null &&
    route.homeLng != null &&
    route.officeLat != null &&
    route.officeLng != null

  // Route avec Home/Office (cas standard) : géo stricte sur les DEUX extrémités —
  // une boucle qui part de chez soi et y revient ne doit jamais matcher, et pas
  // de fallback heure (sinon n'importe quelle activité de la bonne distance et
  // du bon créneau horaire est classée trajet).
  if (routeHasGeo) {
    if (geo.start == null || geo.end == null) return null
    const home: LatLng = [route.homeLat!, route.homeLng!]
    const office: LatLng = [route.officeLat!, route.officeLng!]
    const startAtHome = haversineMeters(geo.start, home) <= route.geoTolM
    const startAtOffice = haversineMeters(geo.start, office) <= route.geoTolM
    const endAtHome = haversineMeters(geo.end, home) <= route.geoTolM
    const endAtOffice = haversineMeters(geo.end, office) <= route.geoTolM
    if (startAtHome && endAtOffice) return 'outbound'
    if (startAtOffice && endAtHome) return 'return'
    return null
  }

  // Route sans Home/Office (cas dégénéré, ne devrait pas arriver via l'UI) : fallback heure pur.
  if (geo.localHour != null) {
    return geo.localHour < route.hourSplit ? 'outbound' : 'return'
  }

  return null
}
```

(L'ancien départage `dHome <= dOffice` disparaît : il servait à désambiguïser le seul point de départ, les deux extrémités le rendent inutile.)

- [ ] **Step 4: Vérifier que toute la suite passe**

```bash
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts
```

Attendu : PASS complet (les tests existants « match géo aller/retour » utilisent déjà des arrivées correctes ; « ni géo concluante ni heure », « sans GPS », « départ loin », fallback heure et sport insensible à la casse restent verts).

- [ ] **Step 5: Vérifier les consommateurs indirects**

```bash
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts __tests__/lib/plan/session-matching.test.ts
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```

Attendu : PASS + tsc silencieux. (`assign-commute-name.ts` n'appelle que `matchCommute`, signature inchangée.)

- [ ] **Step 6: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "fix/commute-endpoint-matching" ] \
  && git -C /c/Users/Franc/app-run-mobile add web/lib/activities/commute.ts web/__tests__/activities/commute.test.ts \
  && git -C /c/Users/Franc/app-run-mobile commit -m "fix(commute): exige départ ET arrivée aux points du trajet pour classer un TAF" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

### Task 2: Retirer « Bascule h » de l'UI + bandeau spec

**Files:**
- Modify: `web/components/settings/CommuteRoutesSection.tsx` (RouteCard lignes ~277-299 et ~370-383 ; AddRouteForm lignes ~423, ~449-457, ~470-478, ~605-619)
- Modify: `docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md` (bandeau Status)

**Interfaces:**
- Consumes: rien de Task 1 (indépendante).
- Produces: rien — composant client autonome. Le type local `CommuteRoute` du composant **garde** son champ `hourSplit` (il décrit le payload de `GET /api/commute-routes`, inchangé) ; seuls les usages disparaissent.

- [ ] **Step 1: Éditer `RouteCard`**

Dans `web/components/settings/CommuteRoutesSection.tsx` :

1. Supprimer la ligne d'état (~279) :
```ts
  const [hourSplit, setHourSplit] = useState(route.hourSplit)
```
2. Dans `saveEdit()`, supprimer la ligne `hourSplit: hourSplit,` du `onPatch({...})`.
3. Dans `cancelEdit()`, supprimer la ligne `setHourSplit(route.hourSplit)`.
4. Dans le bloc d'édition inline, passer la grille de `grid-cols-3` à `grid-cols-2` et supprimer le bloc :
```tsx
            <div>
              <FieldLabel>Bascule h</FieldLabel>
              <NumberInput value={hourSplit} onChange={setHourSplit} />
            </div>
```

- [ ] **Step 2: Éditer `AddRouteForm`**

1. Supprimer la ligne d'état (~423) :
```ts
  const [hourSplit, setHourSplit] = useState(14)
```
2. Dans `reset()`, supprimer `setHourSplit(14)`.
3. Dans le corps du `POST` (`body: JSON.stringify({...})`), supprimer la ligne `hourSplit,` (le champ API reste optionnel, la colonne DB garde son défaut 14).
4. Dans « Options avancées », passer la grille de `grid-cols-3` à `grid-cols-2` et supprimer le même bloc `Bascule h` que ci-dessus.

- [ ] **Step 3: Vérifier**

```bash
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit
cd /c/Users/Franc/app-run-mobile/web && npm run lint
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts
```

Attendu : tsc silencieux (aucune référence orpheline à `hourSplit`/`setHourSplit` dans le composant), lint OK, suite commute verte.

- [ ] **Step 4: Bandeau Status sur la spec**

Dans `docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md`, remplacer la ligne :

```markdown
**Statut** : Spec validée (approche A), en attente d'implémentation
```

par :

```markdown
> **Status: Implémenté** · 2026-08-01 · Code: `web/lib/activities/commute.ts` (resolveDirection), `web/components/settings/CommuteRoutesSection.tsx`
```

- [ ] **Step 5: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "fix/commute-endpoint-matching" ] \
  && git -C /c/Users/Franc/app-run-mobile add web/components/settings/CommuteRoutesSection.tsx docs/superpowers/specs/2026-08-01-commute-endpoint-matching-design.md docs/superpowers/plans/2026-08-01-commute-endpoint-matching.md \
  && git -C /c/Users/Franc/app-run-mobile commit -m "chore(settings): retire le champ « Bascule h » sans effet des trajets TAF" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

## Après exécution

- Merge/push : **uniquement sur demande explicite de Franck** (déploiement = push GitHub → Vercel). Utiliser superpowers:finishing-a-development-branch.
- Vérif manuelle post-déploiement par Franck : (1) un run boucle depuis chez lui dans la fourchette de distance n'est plus renommé ; (2) un vrai aller/retour Runtaf/Vélotaf est toujours détecté ; (3) l'écran Réglages > Trajets n'affiche plus « Bascule h ».
- Rappel hors scope : les activités déjà mal taguées gardent leur titre `2026#N …` — Franck les renomme à la main pour les détacher.
