# Typographie — Charte Trail Cockpit

> Doc vivante. Source de vérité pour la typo. Voir le rendu live sur `/design-system`.

## Polices (charte officielle)

| Rôle | Police | Classe Tailwind | Variable CSS | Poids autorisés |
|---|---|---|---|---|
| Titres · valeurs · chiffres · KPI | **Space Grotesk** | `font-display` (ou `font-data` pour les chiffres) | `--font-space-grotesk` / `--font-data` | 500 · 600 · 700 |
| Texte courant · UI · labels · formulaires | **Inter** | `font-sans` / `font-body` | `--font-inter` / `--font-sans` | 400 · 500 · 600 |

Chargées via `next/font` dans [`web/app/layout.tsx`](../../web/app/layout.tsx) (variable fonts).
Les alias `--font-sans` / `--font-data` sont posés dans [`web/app/globals.css`](../../web/app/globals.css) : tout composant qui utilise `var(--font-data)` ou `var(--font-sans)` suit automatiquement la charte.

**Règle simple :** chiffres importants = Space Grotesk · texte explicatif = Inter.

> Historique : l'app utilisait Manrope + JetBrains Mono (commit `30242939`). Retour à la charte
> Space Grotesk + Inter le 2026-06-08 (décision Franck). JetBrains Mono ne fait plus partie de la marque.

## Échelle typographique

Tokens définis dans [`web/tailwind.config.ts`](../../web/tailwind.config.ts) (`fontSize`).

| Token | Taille | Classe | Usage |
|---|---|---|---|
| Display | 28px | `text-display` | Gros indicateurs, J-xx, hero |
| H1 | 22px | `text-h1` | Titres d'écran |
| H2 | 18px | `text-h2` | Titres de section, titres de modale |
| Body | 14px | `text-body` | Texte courant |
| Body Small | 13px | `text-body-sm` | Texte dans les écrans denses |
| Caption | 12px | `text-caption` | Légendes, sous-textes |
| Micro | 11px | `text-micro` | Labels, méta, eyebrows |

### Quand 14px, quand 13px ?

L'objectif n'est **pas** de forcer toute l'app vers 14px (ça dégraderait la densité d'information),
mais d'avoir un système cohérent.

- **14px (`text-body`)** — écrans aérés et nouveaux écrans : **Onboarding, Réglages, Mission Mode, pages marketing/légales**, corps de paragraphe.
- **13px (`text-body-sm`)** — écrans denses où la densité d'info prime : **Cockpit, Charge, Activités, Plan** (lignes de tableau, cartes compactes, listes).

En cas de doute : un écran « lecture / explication » → 14px ; un écran « cockpit / data dense » → 13px.

## KPI et chiffres

- Police = Space Grotesk. Utiliser la classe **`numeric-kpi`** (définie dans `globals.css`) qui pose
  `font-data` + `tabular-nums` + poids 600 — au lieu d'un `style={{ fontFamily: 'var(--font-data)' }}` inline.
- Pour la chasse fixe sur d'autres chiffres : classe Tailwind native **`tabular-nums`** (pas `fontVariantNumeric` inline).
- Poids max **700** : ne pas utiliser `font-black` / `font-extrabold` (900/800) sur les valeurs.

## À bannir

- Polices hors charte (Bebas, Oswald, Montserrat, Roboto, Poppins, Open Sans, Arial, `sans-serif` générique).
- `style={{ fontFamily: ... }}` inline → utiliser `font-data` / `font-display` / `font-body`.
- `text-[Npx]` arbitraires → utiliser les tokens d'échelle.
- Tailles fractionnaires (`text-[12.5px]`, `fontSize: 9.5`).
- `font-black` / `font-extrabold` (hors charte) et `fontWeight: 800/900` inline.

## Migration

Audit complet et plan de migration progressif : voir l'audit typo (session 2026-06-08).
Étape 0 (fondation + tokens) livrée. Étapes suivantes par zone : nav → onboarding → cockpit → charge → plan → activités → courses → réglages → admin → rapport matinal.
