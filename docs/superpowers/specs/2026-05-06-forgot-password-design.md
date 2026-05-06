# Forgot Password — Trail Cockpit Web

**Date:** 2026-05-06  
**Scope:** Ajout "Mot de passe oublié" dans le module de connexion (Next.js / Supabase Auth)

---

## Objectif

Permettre à un utilisateur de réinitialiser son mot de passe depuis le formulaire de connexion, via un email de reset Supabase.

---

## Fichiers impactés

| Fichier | Type | Changement |
|---|---|---|
| `web/app/page.tsx` | Modifié | Ajout mode `'forgot'` |
| `web/app/login/page.tsx` | Modifié | Ajout mode `'forgot'` inline |
| `web/app/auth/reset/page.tsx` | Créé | Page callback reset mot de passe |

---

## Flux utilisateur

1. L'utilisateur est sur le formulaire login (mode `'login'`)
2. Il clique "Mot de passe oublié ?" → mode `'forgot'`
3. Il saisit son email et soumet
4. Appel : `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/auth/reset' })`
5. Écran de confirmation : "Vérifiez votre email — un lien a été envoyé à `<email>`"
6. Il clique le lien dans l'email → redirigé vers `/auth/reset#access_token=xxx&type=recovery`
7. La page détecte le token Supabase dans le hash URL via `supabase.auth.onAuthStateChange`
8. Affichage du formulaire "nouveau mot de passe" (2 champs + validation concordance)
9. Appel : `supabase.auth.updateUser({ password: newPassword })`
10. Redirect vers `/dashboard` après succès

---

## Modifications `web/app/page.tsx`

- Ajouter `'forgot'` au type `Mode` : `type Mode = 'login' | 'signup' | 'forgot'`
- Ajouter état `forgotSent: boolean` (confirmation envoi email)
- En mode `'login'`, ajouter sous le champ mot de passe un lien `"Mot de passe oublié ?"` (texte xs, aligné à droite, `text-trail-accent`)
- En mode `'forgot'` : afficher uniquement le champ email + bouton "Envoyer le lien" + lien "Retour à la connexion"
- Le champ `password` est rendu `required` uniquement en modes `'login'` et `'signup'`
- Après envoi réussi : afficher écran confirmation (même pattern que `checkEmail` existant)
- La fonction `handleSubmit` gère le cas `mode === 'forgot'` : appel resetPasswordForEmail, puis `setForgotSent(true)`

## Modifications `web/app/login/page.tsx`

- Même pattern : ajouter `mode: 'login' | 'forgot'` et `forgotSent`
- Lien "Mot de passe oublié ?" sous le champ password
- Mode `'forgot'` : email seul + bouton + retour
- Confirmation identique

---

## Nouvelle page `web/app/auth/reset/page.tsx`

- Page client (`'use client'`)
- Au mount : écouter `supabase.auth.onAuthStateChange` — quand l'événement est `PASSWORD_RECOVERY`, la session est établie et on peut appeler `updateUser`
- États : `password`, `confirm`, `error`, `loading`, `done`
- Validation côté client : `password === confirm` et `password.length >= 6`
- Bouton "Enregistrer le nouveau mot de passe"
- Après succès : redirect vers `/dashboard`
- Design : identique à `login/page.tsx` (card centrée, classes `trail-*`)

---

## Configuration Supabase requise

Dans le dashboard Supabase → Authentication → URL Configuration → **Redirect URLs**, ajouter :
- En développement : `http://localhost:3000/auth/reset`
- En production : `https://<domaine>/auth/reset`

Le `redirectTo` passé à `resetPasswordForEmail` doit correspondre exactement à une URL autorisée.

---

## Gestion des erreurs

| Cas | Comportement |
|---|---|
| Email inconnu | Supabase renvoie succès (sécurité — pas d'énumération) — afficher confirmation normalement |
| Token expiré sur `/auth/reset` | `onAuthStateChange` ne déclenche pas `PASSWORD_RECOVERY` — afficher message "Lien expiré, recommencez" avec lien vers `/` |
| Mots de passe ne concordent pas | Validation client avant appel API |
| Erreur `updateUser` | Afficher message d'erreur dans le formulaire |

---

## Hors scope

- Réinitialisation par SMS / magic link
- Rate limiting côté client (Supabase le gère côté serveur)
