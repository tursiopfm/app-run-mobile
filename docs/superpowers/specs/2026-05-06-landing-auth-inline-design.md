> **Status: Implémenté** · Date: 2026-05-06 · Code: `web/app/page.tsx`, `web/components/auth/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Landing page — auth inline

**Date:** 2026-05-06  
**Statut:** Approuvé

## Objectif

Transformer la page d'accueil (`/`) en point d'entrée d'authentification unique : logo réel de l'app, formulaire login/signup inline avec toggle, grille features mise à jour.

## Composants impactés

| Fichier | Action |
|---|---|
| `web/app/page.tsx` | Refonte complète — client component |
| `web/app/signup/page.tsx` | Suppression après validation |
| `web/app/login/page.tsx` | Conservé (accès direct `/login` reste valide) |

## Design

### Logo
- Remplacer `<Mountain>` (lucide) par `<img src="/icons/icon-192.png">` avec fallback texte "TC"
- Taille : 48×48px, border-radius arrondi cohérent avec le thème

### Formulaire auth inline

Page `page.tsx` devient `'use client'` avec état `mode: 'login' | 'signup'`.

**Mode login (défaut) :**
- Champs : email + mot de passe
- Bouton primary : "Se connecter"
- Succès → `router.push('/dashboard')` + `router.refresh()`
- Erreur → message inline (rouge)
- Lien bas : "Pas encore de compte ? Créer un compte" → `setMode('signup')`

**Mode signup :**
- Champs : email + mot de passe (minLength=6)
- Bouton primary : "Créer mon compte"
- Si `data.session` → `router.push('/dashboard')` + `router.refresh()`
- Sinon → afficher message "Vérifiez votre email" avec lien retour login
- Erreur → message inline (rouge)
- Lien bas : "Déjà un compte ? Se connecter" → `setMode('login')`

Le switch de mode conserve les valeurs email et mot de passe déjà saisies.

### Grille features

Remplacer "CES / Score effort multi-sports" par **"Effort / Score effort multi-sports"** dans le tableau des features.

## Logique Supabase

Réutiliser exactement le code existant de `/login/page.tsx` et `/signup/page.tsx` :
- `supabase.auth.signInWithPassword({ email, password })`
- `supabase.auth.signUp({ email, password })`

Pas de nouvelle dépendance.

## Nettoyage

`web/app/signup/page.tsx` supprimé une fois la nouvelle page d'accueil validée en production. La page `/login` reste accessible directement.

## Hors scope

- Modification de `/login/page.tsx`
- Connexion Strava (restait un faux bouton, retirée)
- Mot de passe oublié / reset
