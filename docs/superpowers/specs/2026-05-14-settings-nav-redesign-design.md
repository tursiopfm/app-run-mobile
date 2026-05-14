# Refonte navigation Réglages & accès profil athlète

> **Status: Implémenté** · 2026-05-14 · Code: `web/components/navigation/BottomNav.tsx`, `web/components/navigation/AppShell.tsx`, `web/app/(main)/settings/page.tsx`, `web/app/(main)/profile/page.tsx`, `web/components/settings/IdentityPreview.tsx`, `web/components/settings/HrCalibrationTeaser.tsx`

## Objectif

Décharger la barre de navigation basse (BottomNav) en sortant l'onglet **Réglages** et déplacer l'accès aux réglages vers le bouton `...` (MoreVertical) du header. La page Réglages absorbe alors un aperçu **Profil athlète** qui teaser la page `/profile` (calibration FC).

## Changements

### 1. BottomNav — retrait de Réglages
`web/components/navigation/BottomNav.tsx`
- Suppression de l'entrée `{ href: '/settings', icon: Settings, label: 'Réglages' }`
- BASE_NAV passe de 6 à 5 items : Cockpit · Charge · Plan · Activités · Courses
- Admin reste inchangé (ajouté conditionnellement)

### 2. AppShell — `...` → `/settings`
`web/components/navigation/AppShell.tsx`
- Le `Link` du bouton `MoreVertical` pointe vers `/settings` (au lieu de `/profile`)
- `aria-label="Réglages"` (au lieu de "Profil")

### 3. Page `/settings` — nouvelle section "Profil athlète"
`web/app/(main)/settings/page.tsx`

Insérée **entre** "Compte & sync" et "Apparence". Composée d'une `SectionCard` qui contient :

**a) Identity preview compacte** (lecture seule)
- Avatar (avec image custom ou Strava ou icône fallback)
- Nom complet
- Email
- "Compte créé le …"
- Pas de boutons d'édition (les modifs avancées vivent sur `/profile`)

**b) Tuile teaser "Calibration FC & zones"**
- Lien `Link` vers `/profile`
- Icône cœur (`Heart` lucide) en accent primary
- Titre : "Calibration FC & zones cardiaques"
- Sous-ligne dynamique :
  - Si méthode configurée : `Méthode : <label> · FCmax <X> · Seuil <Y>` (valeurs présentes uniquement)
  - Si pas calibré : `Pas encore configuré — calibre tes zones`
- Badge de fiabilité de la méthode (couleur + label de `hr-method-meta.ts`)
- `ChevronRight` à droite
- Hover et focus visibles

### 4. Page `/profile` — allégée
`web/app/(main)/profile/page.tsx`
- Retrait de `IdentityCard` (passe dans Réglages)
- Conservation de `HrCalibrationCard`
- Titre de page : "Calibration FC & zones cardiaques"
- Sous-titre conservé

## Livraison — mockup d'abord

Route auto-portante `/mockup/settings` (non liée au reste de l'app) :
- Page server component sous `web/app/mockup/settings/page.tsx` (en dehors du groupe `(main)` pour ne pas hériter de l'AppShell réelle)
- Reproduit le header (sans wrapper AppShell), la nouvelle page Réglages avec **vraies données Supabase**, et un faux BottomNav sans Réglages
- Aucune écriture vers le vrai code de navigation
- Franck visite l'URL, valide visuellement
- Puis Phase 2 : on bascule les vrais fichiers et on supprime `/mockup/settings`

## Composants à créer dans le mockup

- `MockupHeader` (inline) — copie de AppShell header, `...` pointe vers `#`
- `MockupBottomNav` (inline) — 5 items
- `IdentityPreviewCard` — version read-only de l'IdentityCard (réutilisable plus tard pour le vrai code)
- `HrCalibrationTeaser` — la tuile teaser, à réutiliser ensuite

## Hors scope

- Modifications du label `tabs.settings` dans `labels.ts` (pas utilisé directement par BottomNav, qui hardcode "Réglages")
- Modification du middleware ou des redirections
- Réorganisation du contenu de `HrCalibrationCard`

## Tests visuels à faire valider

- Densité du nouveau bloc "Profil athlète" (ni trop chargé ni trop maigre)
- Couleur/badge de la méthode FC dans la tuile teaser
- État "pas encore calibré" (visualiser via un cas vide)
- Ordre vertical : hero · Compte & sync · **Profil athlète** · Apparence · Bientôt · Aide

## Drift notes

- `IdentityPreview` est cliquable et navigue vers `/profile/identity`, qui héberge l'`IdentityCard` (édition avatar + nom). ChevronRight + hover state alignés sur ceux de l'`HrCalibrationTeaser`.
- Le label `tabs.settings` dans `labels.ts` n'est plus utilisé par le BottomNav mais reste exporté (utilisé ailleurs possible — non vérifié).
