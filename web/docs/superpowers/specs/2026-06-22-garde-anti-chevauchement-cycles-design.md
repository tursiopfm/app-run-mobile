# Garde anti-chevauchement de cycles (macrocycles)

> Spec validée le 2026-06-22. Couverture : ② — garde sur **tous** les chemins
> de création/édition d'un macrocycle.

## Contexte & problème

Incident du 2026-06-22 (compte Franck). L'onglet Plan n'affiche qu'**un seul**
macrocycle « actif » : `PlanClient` lit `getCurrentPlan()` →
`pickActiveMacrocycle()`, qui retourne **un** plan, et **aucun sélecteur** ne
permet de basculer vers les autres.

Franck avait deux macrocycles `active` qui se chevauchaient :

- **« Macrocycle 2026-05-22 »** — sa vraie structure (4 phases : Récup → Foncier
  Ultra marin → Récup → Spécifique TDS), 10/05 → 30/08.
- **« Prépa Ultra marin »** — 1 phase Affûtage 19/06 → 26/06 (édité le 21/06).

Règle de départage de `pickActiveMacrocycle` : si plusieurs cycles sont en cours
aujourd'hui, prendre celui dont la `start_date` est la **plus récente**. Le
19/06, le petit cycle d'affûtage est entré dans sa fenêtre et a **masqué
silencieusement** la structure détaillée. Vécu utilisateur : « j'ai perdu toutes
mes structures de préparation ». Aucune donnée n'était perdue — uniquement
invisible.

**Remédiation immédiate déjà appliquée** (hors périmètre de cette spec) :
suppression de « Prépa Ultra marin » après détachement (`plan_id → NULL`) de ses
7 séances planifiées pour les préserver. Il ne reste qu'un macrocycle.

**Objet de cette spec :** empêcher que ce masquage silencieux se reproduise, en
**avertissant + proposant** au moment où un cycle qui chevauche un autre cycle
actif est enregistré.

## Décisions de design

- **Comportement = « avertir + proposer »** (choix Franck), pas un blocage dur.
- Le garde se déclenche **à l'enregistrement** d'un macrocycle (création **ou**
  édition de dates), pas seulement à la création — l'incident est né d'une
  **édition** de dates d'un cycle existant.
- Couverture **②** : tous les chemins de save passent par le garde.
- « Actif » = `status !== 'archived'` — exactement la définition d'affichage de
  `pickActiveMacrocycle`, pour rester cohérent.

## Architecture (3 unités isolées)

### 1. `web/lib/plan/overlap.ts` — détection pure (sans I/O)

```ts
findActiveOverlaps(candidate: TrainingPlan, all: TrainingPlan[]): TrainingPlan[]
```

Retourne les cycles de `all` tels que :
- `other.id !== candidate.id` (exclut soi-même — cas édition) ;
- `other.status !== 'archived'` ;
- les périodes se chevauchent au sens **strict** :
  `candidate.startDate < other.endDate && other.startDate < candidate.endDate`.

**Frontière stricte (`<`) :** un cycle **imbriqué** (19→26/06 dans 10/05→30/08)
ou un vrai recouvrement sont signalés ; deux cycles **bout-à-bout** partageant un
seul jour-frontière (A finit le 28/06, B démarre le 28/06) ne le sont **pas**.
Les dates sont des chaînes ISO `YYYY-MM-DD` → la comparaison lexicographique est
chronologique.

Module pur, aucune dépendance React/Supabase → entièrement testable au jest.

### 2. `web/components/plan/useOverlapGuard` — hook d'orchestration + dialogue

Expose :

```ts
{ guardedSave: (candidate: TrainingPlan) => Promise<boolean>, dialog: ReactNode }
```

`guardedSave(candidate)` :
1. charge tous les cycles via `getAllMacrocycles()` ;
2. `findActiveOverlaps(candidate, all)` ;
3. **aucun conflit** → `saveCurrentPlan(candidate)`, résout `true` ;
4. **conflit** → ouvre le dialogue et **attend le choix** de l'utilisateur
   (promesse résolue par l'interaction) :
   - **Archiver le(s) cycle(s) en conflit** → pour chaque cycle en conflit,
     `saveCurrentPlan({ ...conflit, status: 'archived' })`, puis
     `saveCurrentPlan(candidate)` → `true` ;
   - **Confirmer quand même** → `saveCurrentPlan(candidate)` (chevauchement
     assumé) → `true` ;
   - **Ajuster les dates / Annuler** → aucun enregistrement → `false`
     (l'appelant reste dans l'éditeur).

`dialog` est un overlay rendu via `createPortal(document.body)` (convention
projet pour les overlays plein écran). Le hook porte l'état d'ouverture + la
liste des conflits + le resolver de la promesse.

`saveCurrentPlan` invalide déjà le cache macros (`invalidateMacrosCache`) — pas
de gestion de cache supplémentaire. L'archivage ne réutilise aucune infra
nouvelle (le statut `archived` existe déjà).

### 3. Câblage des deux chemins de save

- **`PhaseEditorModal.handleSave`** ([L248-285]) : remplacer
  `await saveCurrentPlan(updated)` par `const ok = await guardedSave(updated); if (ok) { onSaved(); onClose() }`. Rendre `{dialog}` dans le composant.
- **`StructurePrepaBlock`** : les deux saves
  (`saveMacrocycle(newPlan)` création auto, `saveCurrentPlan(updated)` génération
  de phases) passent par `guardedSave` ; rendre `{dialog}`.

> Note : la création auto « cas 1 » de `StructurePrepaBlock` ne se déclenche que
> lorsqu'**aucun** macrocycle n'existe (`!activeMacrocycle` ⇔ `pickActiveMacrocycle`
> a renvoyé `null` ⇔ zéro cycle) ; un conflit y est donc impossible en pratique,
> mais le garde y est branché par uniformité (coût nul).

## Flux UX

Dialogue d'avertissement (titre + corps) :
- « Ce cycle recouvre **{nom}** ({start} → {end}) ». Liste si plusieurs conflits.
- 3 boutons : **Archiver {nom}** (action principale) · **Ajuster les dates** ·
  **Confirmer quand même**.

Aucun changement de comportement quand il n'y a pas de conflit (chemin actuel
inchangé).

## i18n

Nouvelles clés dans `web/lib/i18n/dictionaries/fr.ts` + `en.ts`, sous `plan` :
titre du dialogue, gabarit de message (`overlapBody(name, start, end)`),
libellés des 3 actions, libellé pluriel si plusieurs conflits.

## Gestion d'erreur & cas limites

- **Édition** : le candidat est dans `all` → exclu par `id`, pas d'auto-conflit.
- **Création** : l'`id` du candidat n'est pas encore dans `all` → pas de
  faux positif.
- **`completed`** : un cycle `completed` reste « actif » au sens affichage
  (non `archived`) → il **peut** masquer → il est donc inclus dans la détection.
- **Échec d'archivage / save** : le hook propage l'erreur ; `guardedSave` résout
  `false` (l'éditeur reste ouvert, l'utilisateur peut réessayer). Pas de toast
  dédié (cohérent avec l'absence de gestion d'erreur explicite des saves
  actuels).

## Compromis assumé

« Confirmer quand même » réintroduit volontairement le scénario d'origine (deux
cycles non-archivés qui se chevauchent → `pickActiveMacrocycle` n'en montre
qu'un). C'est un choix **informé** de l'utilisateur, cohérent avec l'option
« avertir + proposer » retenue. Le sélecteur de cycle (approche alternative non
retenue) reste une piste future si le besoin de prépas imbriquées se confirme.

## Tests

- **`findActiveOverlaps`** (jest, cœur de la logique) :
  - chevauchement franc → signalé ;
  - imbrication totale (cas Franck) → signalé ;
  - bout-à-bout, frontière partagée → **non** signalé ;
  - cycle `archived` → exclu ;
  - soi-même (même `id`) → exclu ;
  - conflits multiples → tous retournés ;
  - aucun conflit → tableau vide.
- **Hook/dialogue** : test léger si pertinent ; la logique métier testable vit
  dans la fonction pure.

## Hors périmètre

- Sélecteur de macrocycle dans l'onglet Plan.
- Migration / nettoyage des chevauchements déjà présents en base sur d'autres
  comptes (détection seulement à l'enregistrement, pas de balayage rétroactif).
- Blocage dur (option non retenue).
