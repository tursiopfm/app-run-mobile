# Éditeur unifié d'un trajet TAF (titres + tolérance + points)

**Date** : 2026-08-02
> **Status: Implémenté** · 2026-08-02 · Code: `web/components/settings/CommuteRouteEditor.tsx`, `web/components/settings/CommuteRoutesSection.tsx`

## Problème

L'édition d'un trajet domicile-travail est éclatée sur deux surfaces : un bloc
inline dans la carte du trajet (titres aller/retour + « Tol. géo m ») et un
éditeur plein écran séparé pour les points Home/Office. Deux liens texte
soulignés les ouvrent, ce qui alourdit la carte et oblige à deux allers-retours
pour configurer un trajet.

## Objectif

Une seule page d'édition pour tout ce qui concerne un trajet, ouverte par un
petit bouton sur la carte du trajet.

## Design

### 1. Carte du trajet — `web/components/settings/CommuteRoutesSection.tsx`

`RouteCard` :
- En-tête (icône sport, label, sous-titre sport, badge Actif/Inactif, bouton
  supprimer) et aperçus des titres aller/retour : **inchangés**.
- Les deux liens soulignés (« Modifier les titres & tolérances », « Modifier
  les points Home / Office ») sont remplacés par **un bouton contour compact**
  « Modifier » avec icône crayon (`Pencil` de lucide-react, taille 12) :
  `border border-trail-primary text-trail-primary bg-transparent`, arrondi
  `10px`, padding `px-[10px] py-[5px]`, texte `text-micro font-semibold` —
  style secondaire du projet, lisible dans les deux thèmes.
- Le bloc d'édition inline (états `outbound`, `ret`, `geoTol`, `editing`,
  fonctions `saveEdit`/`cancelEdit`, champs et boutons Enregistrer/Annuler)
  **disparaît** : toute l'édition vit dans l'éditeur plein écran.
- `RouteCard` conserve `onDelete` et `onPatch` (le toggle Actif/Inactif utilise
  toujours `onPatch`). Le prop `onPointsSaved` devient `onSaved` et reçoit
  l'ensemble des champs modifiés.

### 2. Éditeur — `web/components/settings/CommutePointsEditor.tsx` → `CommuteRouteEditor.tsx`

Le composant est **renommé** (fichier + export) en `CommuteRouteEditor`, car il
n'édite plus seulement les points. Il reste `'use client'`, monté via
`createPortal(document.body)` et chargé par `next/dynamic` `ssr: false`.

Structure verticale, **page scrollable** :

1. **En-tête** (fixe en haut) : « Modifier le trajet » + label du trajet +
   bouton fermer (`aria-label="Fermer"`).
2. **Titre aller** puis **Titre retour** : `FieldLabel` + input texte, chacun
   précédé de la pastille `{année}#N` en rappel du préfixe auto (même rendu que
   le formulaire d'ajout).
3. **Tol. géo m** : `FieldLabel` + input nombre.
4. **Section points** : puces « 🏠 Home » / « 🏢 Office » (Home actif par
   défaut), champ de recherche d'adresse (BAN, debounce 300 ms, min 3
   caractères, message discret si `searchAddress` renvoie `null`), puis la
   carte Leaflet à **hauteur fixe `45vh`** (dans une page scrollable, une
   hauteur flexible serait écrasée par les champs). Marqueurs emoji draggables,
   tap-pour-placer, tap-marqueur-pour-sélectionner, `ICONS` stables au niveau
   module : **comportement actuel inchangé**.
5. **Pied collant** (`sticky bottom-0`, fond `--trail-bg`, bordure haute) :
   rappel « Après modification, relance “Appliquer à l'historique” pour
   re-détecter les trajets avec les nouveaux points. », message d'erreur
   éventuel, puis **Enregistrer** / **Annuler**.

**Enregistrer** : un seul `PATCH /api/commute-routes/[id]` portant
`{ outboundTitle, returnTitle, geoTolM, homeLat, homeLng, officeLat, officeLng }`
— l'API accepte déjà tous ces champs (aucun changement serveur). Succès →
`onSaved(patch)` puis fermeture ; échec → message inline, l'éditeur reste
ouvert. **Annuler** ferme sans rien écrire (sémantique modale).

Type exporté renommé : `CommutePoints` → `CommutePatch` =
`{ outboundTitle: string; returnTitle: string; geoTolM: number; homeLat: number; homeLng: number; officeLat: number; officeLng: number }`.

### 3. Hors scope

- Formulaire d'ajout d'un trajet (`AddRouteForm`) : inchangé.
- API, DB, migrations : inchangées (le PATCH accepte déjà ces champs).
- Logique de matching (`web/lib/activities/commute.ts`) : inchangée.
- `web/lib/geo/ban-geocode.ts` : inchangé.

## Vérification

- `npx tsc --noEmit` + `npm run lint` verts (aucune référence orpheline à
  `CommutePointsEditor` / `CommutePoints` dans le repo).
- `npx jest __tests__/activities/commute.test.ts __tests__/lib/geo/ban-geocode.test.ts __tests__/app/api/commute-routes/patch-points.test.ts`
  verts (aucune de ces suites ne teste le composant, non testable en jsdom).
- Vérif manuelle Franck après déploiement : le bouton « Modifier » ouvre une
  page unique ; modifier un titre, la tolérance et un point puis Enregistrer
  persiste les trois (rouvrir l'éditeur le confirme) ; Annuler n'écrit rien ;
  rendu correct dans les deux thèmes et sur téléphone (~390 px), carte
  utilisable sans que le scroll de la page la rende inaccessible.
