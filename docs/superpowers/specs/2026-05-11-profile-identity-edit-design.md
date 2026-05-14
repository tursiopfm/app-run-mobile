> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/components/settings/IdentityCard.tsx`, `web/app/api/profile/avatar/route.ts`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Design — Édition identité athlète (nom/prénom + avatar)

**Date :** 2026-05-11  
**Scope :** Page Profil (`/profile`) — `IdentityCard` + upload avatar

---

## Contexte

La page Profil affiche actuellement une `IdentityCard` en lecture seule (nom + avatar Strava) et une `HrCalibrationCard`. L'utilisateur ne peut ni modifier son nom/prénom directement dans cette carte, ni changer sa photo de profil autrement qu'en synchronisant Strava.

La table `profiles` possède déjà les colonnes `first_name`, `last_name` et `avatar_url`. L'API `PATCH /api/profile` accepte déjà `first_name` et `last_name`. Supabase Storage n'est pas encore utilisé dans le projet.

---

## Fonctionnalités à implémenter

### 1. Édition inline du nom/prénom dans IdentityCard

- `IdentityCard` devient un composant client (`'use client'`).
- En mode lecture : le bloc nom/prénom affiche une icône crayon (lucide `Pencil`) au hover.
- Clic sur le nom ou le crayon → passage en mode édition :
  - Deux `<input type="text">` inline (Prénom / Nom), stylisés comme les champs existants du projet.
  - Bouton **Enregistrer** et lien **Annuler**.
- Enregistrement : `PATCH /api/profile` avec `{ first_name, last_name }`.
- Succès : retour en mode lecture avec les nouvelles valeurs.
- Erreur : message d'erreur inline, champs restent éditables.

### 2. Upload avatar personnalisé

- L'avatar circulaire affiche une icône caméra (`Camera` lucide) au hover.
- Clic → déclenche un `<input type="file" accept="image/*" hidden>`.
- Upload via `POST /api/profile/avatar` (FormData).
- Pendant l'upload : spinner sur l'avatar.
- Succès : l'avatar se met à jour immédiatement (URL retournée par l'API).
- Si un avatar custom est présent : bouton discret **Retirer** sous l'avatar → `DELETE /api/profile/avatar` → remet `avatar_url = null`, retour à l'avatar Strava.

### 3. Priorité d'affichage de l'avatar

```
profiles.avatar_url  (custom uploadé)   ← prioritaire
  └─ si null → athlete_data.profile    (Strava)
       └─ si null → icône User (fallback)
```

---

## Architecture

### Composants modifiés

| Fichier | Changement |
|---|---|
| `web/components/settings/IdentityCard.tsx` | Devient client, ajoute mode édition nom + upload avatar |
| `web/app/(main)/profile/page.tsx` | Ajoute `avatar_url` dans le select profiles, passe la priorité avatar |

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `web/app/api/profile/avatar/route.ts` | POST (upload) + DELETE (reset) |

### Supabase Storage

- Bucket : `avatars` (public, fichiers non-devinables via UUID)
- Chemin : `{user_id}/avatar.{ext}`
- Overwrite à chaque upload (même chemin = remplacement)
- URL : URL publique Supabase retournée et stockée dans `profiles.avatar_url`

### API `/api/profile/avatar`

**POST** (FormData `file`) :
1. Auth Supabase — 401 si non authentifié.
2. Valide type MIME (`image/jpeg`, `image/png`, `image/webp`) et taille max 5 MB.
3. Upload vers `avatars/{user_id}/avatar.{ext}` avec `upsert: true`.
4. Récupère l'URL publique.
5. `UPDATE profiles SET avatar_url = <url> WHERE id = user_id`.
6. Retourne `{ url: string }`.

**DELETE** :
1. Auth Supabase.
2. `UPDATE profiles SET avatar_url = null WHERE id = user_id`.
3. (Optionnel) Supprime le fichier dans Storage.
4. Retourne `{ ok: true }`.

---

## Flux de données

```
profile/page.tsx (Server)
  ├─ SELECT profiles: first_name, last_name, avatar_url, ...
  ├─ SELECT provider_connections: athlete_data (Strava avatar fallback)
  └─ avatarUrl = profiles.avatar_url ?? athlete_data.profile ?? null
       ↓
IdentityCard (Client)
  ├─ [mode lecture] nom + avatar (cliquable)
  └─ [mode édition]
       ├─ inputs prénom/nom → PATCH /api/profile
       └─ file input → POST /api/profile/avatar
                    → DELETE /api/profile/avatar (retirer)
```

---

## Contraintes & non-objectifs

- Pas de recadrage d'image (crop) — l'image est uploadée telle quelle.
- Pas de validation de dimensions minimales.
- La suppression du fichier Storage au DELETE est optionnelle (pas bloquant).
- `ProfileSection.tsx` (existant) n'est pas modifié ni réintégré dans `/profile`.
- Le bucket Supabase doit être créé manuellement via le Dashboard Supabase (SQL ci-dessous à coller).

### SQL pour le bucket (Dashboard Supabase)

```sql
-- Créer le bucket avatars (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy : lecture publique
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy : upload/update par owner
CREATE POLICY "Owner upload avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner update avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy : suppression par owner
CREATE POLICY "Owner delete avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```
