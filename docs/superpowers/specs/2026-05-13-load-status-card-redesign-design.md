> **Status: Implémenté** · Date: 2026-05-13 · Code: `web/components/charge/blocks/LoadStatusCard.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Refonte du bloc « État du jour » (LoadStatusCard)

**Date** : 2026-05-13
**Scope** : `web/` — onglet Charge
**Statut** : Spec approuvée par Franck (verdicts coach, seuils 0.85/1.15, points colorés CSS)

---

## 1. Contexte & problème

Le bloc « État du jour » (premier bloc de l'onglet Charge) présente trois défauts visibles dans l'UI actuelle :

1. **Duplication de texte** — la phrase de synthèse (ex. _« Fatigue normale d'entraînement. C'est cohérent en phase de charge. »_) apparaît à la fois en bas du titre **et** dans le badge jaune en haut à droite. Les deux strings sont **identiques** car elles dérivent du même `StatusId` ([labels.ts:159](../../../lib/design/labels.ts#L159) ⇄ [charge-insights.ts:356](../../../lib/analytics/charge-insights.ts#L356)).
2. **Pas de verdict actionnable** — l'utilisateur lit un constat (« fatigue normale ») mais ne sait pas s'il doit **pousser, maintenir, ou alléger** son entraînement.
3. **Trois KPIs non expliqués** — `Fatigue récente 105` / `Base de forme 92` / `Fraîcheur −13` sont affichés sans qualification (« c'est élevé ? c'est bien ? »).

Le bouton info (i) actuel décrit la mécanique (« ratio fatigue 7j / base 42j ») et mentionne le jargon ATL/CTL/TSB, ce qui n'aide pas à interpréter les chiffres.

## 2. Objectif

Transformer « État du jour » en **carte coach** qui répond en un coup d'œil à trois questions de l'utilisateur :

- **Quoi faire aujourd'hui ?** (verdict d'action)
- **Pourquoi ?** (raison courte attachée au verdict)
- **Comment lire mes 3 chiffres ?** (mot-statut coloré sous chaque KPI)

Sans introduire de nouvelle source de données : on réutilise `payload.insights.status` et les `dailyMetrics` déjà calculés.

## 3. Anatomie de la carte (3 zones)

```
┌─ ⚖️ État du jour ────────────────────── ⓘ ⋮ ─┐
│                                              │
│  ZONE 1 — VERDICT COACH                      │
│  Tu peux maintenir le rythme.                │
│  Fatigue normale pour ta phase de            │
│  charge — ça passe.                          │
│                                              │
│  ───────────────────────────────────────     │
│                                              │
│  ZONE 2 — 3 KPIs + mots-statut colorés       │
│  Fatigue récente │ Base forme │ Fraîcheur    │
│       105        │     92     │    −13       │
│  • Élevée        │ • Solide   │ • Légère     │
│   (orange)       │   (vert)   │   fatigue    │
│                  │            │   (orange)   │
└──────────────────────────────────────────────┘
```

**Changements vs implémentation actuelle :**
- Suppression du **badge `statusLabel`** en haut à droite (la pillule colorée).
- Le **verdict prend toute la largeur** sous le titre — première phrase en gras (verbe d'action), seconde phrase en texte normal (raison).
- Sous chaque KPI : **mot-statut** précédé d'un **point coloré CSS** (`<span className="inline-block w-1.5 h-1.5 rounded-full" style={{backgroundColor}}/>`). Pas d'emoji.

### 3.1 Hiérarchie typographique (zone verdict)

| Élément | Police | Notes |
|---|---|---|
| Verbe d'action | `text-[14px] font-bold text-trail-text` | Première phrase complète |
| Raison | `text-[12px] text-trail-muted leading-[16px]` | Phrase qui suit |

Pas d'icône, pas de fond coloré. La carte garde le style sobre des autres blocs.

### 3.2 KPIs (zone 2) — adjustements

Structure existante conservée (`grid grid-cols-3 gap-2`), mais on **ajoute** un troisième élément sous le chiffre :

```tsx
<div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center">
  <p className="text-[10px] text-trail-muted">Fatigue récente</p>
  <p className="text-[18px] font-black mt-0.5" style={{ color: chargeOrange }}>105</p>
  <p className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1" style={{ color: statusColor }}>
    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
    Élevée
  </p>
</div>
```

Les **couleurs de chiffre** existantes (orange pour ATL, bleu pour CTL, status-color pour TSB) sont **conservées**. Le nouveau mot-statut utilise une couleur **indépendante** liée à son propre seuil (voir §5).

## 4. Verdicts coach (9 statuts)

Source unique : `web/lib/design/labels.ts` → nouveau sous-objet `charge.verdict.{statusId}` qui remplace l'usage de `charge.status.{statusId}`. Chaque verdict est composé de **deux phrases** séparées par un saut de ligne logique :

| StatusId | Verbe d'action (gras) | Raison (texte normal) |
|---|---|---|
| `loaded` | Tu peux maintenir le rythme. | Fatigue normale pour ta phase de charge — ça passe. |
| `overloaded` | Lève le pied 1-2 jours. | Ta fatigue est marquée, la récupération devient prioritaire. |
| `peak` | Pic de charge cette semaine. | Soigne ta récupération avant de remettre une grosse séance. |
| `under-trained` | Tu peux remonter le volume. | Tu es très frais mais ta base reste à construire. |
| `very-fresh` | Bonne fenêtre pour intensifier. | Tu es bien reposé, c'est le moment d'une séance qualité. |
| `light` | Charge légère cette semaine. | Utile si tu récupères — sinon tu peux relancer. |
| `progressing` | Continue à charger prudemment. | Tu progresses au-dessus de ta moyenne, surveille les signaux. |
| `balanced` | Suis ton plan normalement. | Charge et fraîcheur sont équilibrées. |
| `insufficient` | Pas encore assez de données. | Reviens après quelques séances pour avoir un verdict fiable. |

**Structure dans labels.ts :**

```ts
verdict: {
  loaded:        { action: "Tu peux maintenir le rythme.", reason: "Fatigue normale pour ta phase de charge — ça passe." },
  overloaded:    { action: "Lève le pied 1-2 jours.",      reason: "Ta fatigue est marquée, la récupération devient prioritaire." },
  // … 9 entrées
}
```

L'ancien sous-objet `charge.status.{...}` peut être **supprimé** : aucun autre composant ne l'utilise (à vérifier par grep avant suppression dans le plan).

L'ancien champ `payload.insights.headline` reste utilisé en interne par le moteur d'insights (`computeLoadInsights` dans [charge-insights.ts](../../../lib/analytics/charge-insights.ts)) mais n'est **plus affiché** dans `LoadStatusCard`. La carte lit directement `charge.verdict[payload.insights.status]`.

## 5. Mots-statut sous les 3 KPIs

Trois fonctions pures, déclaratives, dans un nouveau fichier helper `web/lib/analytics/charge-kpi-status.ts`. Chacune prend les valeurs nécessaires et retourne `{ label: string, color: string }`.

### 5.1 `kpiStatusFatigue(atl: number, ctl: number)`

| Condition | Label | Couleur |
|---|---|---|
| `ctl > 0 && atl > ctl * 1.15` | `Élevée` | `seriesOrange` (`#FF6B35`) |
| `ctl > 0 && atl < ctl * 0.85` | `Modérée` | `seriesBlue` (`#38BDF8`) |
| autres cas (incl. `ctl === 0`) | `Habituelle` | `subtleText` (gris) |

### 5.2 `kpiStatusFitness(ctl: number)`

| Condition | Label | Couleur |
|---|---|---|
| `ctl < 20` | `À construire` | `subtleText` |
| `ctl < 40` | `En progression` | `seriesBlue` |
| `ctl < 60` | `Solide` | `seriesGreen` |
| `ctl >= 60` | `Très solide` | `seriesGreen` |

### 5.3 `kpiStatusFreshness(tsb: number)`

Mappe directement sur les seuils `FRESHNESS` déjà définis dans [`charge-thresholds.ts`](../../../lib/analytics/charge-thresholds.ts) :

| Zone (tsb) | Label | Couleur |
|---|---|---|
| `tsb >= 15` (veryFresh) | `Très frais` | `seriesBlue` |
| `tsb >= 5` (fresh) | `Frais` | `seriesBlue` |
| `tsb > -10` (balanced) | `Équilibrée` | `seriesGreen` |
| `tsb > -25` (normal-fatigue) | `Légère fatigue` | `seriesOrange` |
| `tsb <= -25` (high-fatigue) | `Fatigué` | `seriesRed` |

Les labels sont **également** déplacés dans `labels.ts` sous `charge.kpiStatus.{fatigue,fitness,freshness}.*` pour cohérence i18n. Les fonctions du helper retournent un identifiant (`'high' | 'usual' | …`) que la carte mappe à `labels.charge.kpiStatus.fatigue.high` etc.

## 6. Contenu du bouton info (i)

Remplacer `charge.help.status` ([labels.ts:192](../../../lib/design/labels.ts#L192)) par un texte pédagogique structuré (rendu par `BlockHelpSheet` qui accepte du texte multi-lignes) :

```
L'État du jour synthétise ta forme actuelle en comparant
ta fatigue récente à ta condition de fond.

• Fatigue récente — ton niveau de charge sur les 7 derniers jours.
  Plus c'est haut, plus tu accumules.

• Base de forme — ta condition construite sur ~6 semaines
  d'entraînement. Elle monte progressivement avec la régularité.

• Fraîcheur — différence entre ta base et ta fatigue.
  Négatif = fatigué, positif = reposé. Un peu négatif est normal
  en phase de charge.

Le verdict en haut combine ces 3 signaux pour te dire si tu
peux pousser, maintenir, ou alléger.
```

Aucune mention d'ATL/CTL/TSB dans le help text. Les valeurs techniques restent disponibles via le **tooltip HTML `title=`** sur chaque KPI (déjà présent dans le code actuel — conservé).

**Note**: vérifier dans le plan que `BlockHelpSheet` rend bien les sauts de ligne (sinon, le helpBody devra être un string `\n`-séparé et le composant devra mapper sur `<p>` ou utiliser `whitespace-pre-line`).

## 7. Modifications de fichiers (résumé)

| Fichier | Action | Détail |
|---|---|---|
| [labels.ts](../../../lib/design/labels.ts) | Modifier | Ajouter `charge.verdict.{9 statuts}` (chaque entrée: `{action, reason}`). Ajouter `charge.kpiStatus.{fatigue,fitness,freshness}.*`. Remplacer `charge.help.status` (texte pédagogique). Supprimer `charge.status.{...}` après vérif d'usage. |
| [LoadStatusCard.tsx](../../../components/charge/blocks/LoadStatusCard.tsx) | Refonte | Supprimer le badge `statusLabel`. Afficher `verdict.action` (bold) + `verdict.reason` (muted) sous le titre. Ajouter sous chaque KPI un sous-élément `{point coloré + mot-statut}` calculé via le nouveau helper. |
| `web/lib/analytics/charge-kpi-status.ts` | **Nouveau** | 3 fonctions pures `kpiStatusFatigue`, `kpiStatusFitness`, `kpiStatusFreshness` retournant `{ id, color }`. La carte mappe `id` → label via `labels.charge.kpiStatus.*`. |
| [charge-insights.ts](../../../lib/analytics/charge-insights.ts) | Inchangé | `HEADLINES` et `computeLoadInsights` restent (utilisés ailleurs ? — à confirmer par grep dans le plan). |

## 8. Tests

Tests unitaires (Vitest) sur le nouveau helper `charge-kpi-status.ts` :

- **`kpiStatusFatigue`** : 4 cas — `atl=120, ctl=100` → `high` ; `atl=80, ctl=100` → `low` ; `atl=100, ctl=100` → `usual` ; `atl=50, ctl=0` → `usual` (garde-fou division).
- **`kpiStatusFitness`** : 4 cas — `ctl=10` → `building` ; `ctl=30` → `progressing` ; `ctl=50` → `solid` ; `ctl=80` → `very-solid`.
- **`kpiStatusFreshness`** : 5 cas, un par zone, alignés sur les seuils `FRESHNESS`.

Pas de test snapshot pour la carte elle-même (le visuel est mieux validé par le navigateur). Verifier en runtime que les 9 verdicts s'affichent correctement en forçant les statuts depuis un payload de test.

## 9. Non-objectifs

- Ne pas modifier le calcul de `pickStatus` ni les seuils (`FRESHNESS`, `LOAD_BALANCE`).
- Ne pas toucher aux 11 autres blocs de l'onglet Charge.
- Ne pas changer la mécanique de drag-and-drop / hide du `BlockCard`.
- Ne pas ajouter de tracking analytics ou de logging — out of scope.

## 10. Critères d'acceptation

1. Sur un payload avec `status=loaded` (ex. ATL=105, CTL=92, TSB=−13), la carte affiche :
   - Verdict en gras : « Tu peux maintenir le rythme. »
   - Raison : « Fatigue normale pour ta phase de charge — ça passe. »
   - Sous Fatigue récente (105) : point orange + « Élevée »
   - Sous Base de forme (92) : point vert + « Très solide »
   - Sous Fraîcheur (−13) : point orange + « Légère fatigue »
2. Le badge jaune en haut à droite n'apparaît plus.
3. Aucun texte n'est dupliqué entre la zone verdict et les KPIs.
4. Le bouton (i) ouvre un sheet avec le nouveau texte pédagogique, sans mention ATL/CTL/TSB.
5. Le tooltip HTML sur survol de chaque chiffre montre toujours la valeur technique (`ATL: 105` etc.).
6. Les 9 verdicts coach sont accessibles (changer `status` dans le payload mock pour les vérifier un par un).
7. Tests Vitest passent pour `charge-kpi-status.ts`.
