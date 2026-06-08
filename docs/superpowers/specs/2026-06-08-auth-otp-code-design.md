# Auth par code OTP à 6 chiffres (anti-prefetch) — Design

> **Status: Implémenté** · 2026-06-08 · Code: web/components/auth/LoginForm.tsx, web/components/auth/OtpCodeInput.tsx

## Contexte / Problème

La confirmation d'inscription et la réinitialisation de mot de passe reposent aujourd'hui
sur un **lien magique** (`/auth/confirm?token_hash=…&type=…`). Ce lien porte un OTP à
**usage unique**.

Bug constaté le 2026-06-08 (compte `franck.meri@orange.com`) : après clic sur
« Confirmer mon email », l'utilisateur atterrit sur `/login?error=confirm` au lieu d'être
connecté.

**Cause racine confirmée par les logs auth Supabase** (projet *Run Cockpit*) :

```
12:31:55  POST /verify → 200  user_signedup           (token consommé)
12:31:57  POST /verify → 403  otp_expired             ("One-time token not found")
```

Le lien reçu était emballé par `safelinks.protection.outlook.com` (scanner anti-phishing
Microsoft/Orange). Le scanner **prefetch** le lien pour l'analyser → il consomme l'OTP à
usage unique **avant** que l'utilisateur clique. Quand l'utilisateur clique ~2 s plus tard,
le token est déjà brûlé → 403 → redirection `/login?error=confirm`.

C'est un mode d'échec **documenté** par Supabase :
[OTP Verification Failures — root cause: email prefetching](https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0).
Le même problème affecte le flux « mot de passe oublié » (lesson 2026-06-08).

## Objectif

Rendre la confirmation d'inscription et la réinitialisation de mot de passe **immunisées
contre le prefetch des scanners email**, en supprimant le lien cliquable au profit d'un
**code à 6 chiffres** que l'utilisateur recopie.

> ⚠️ **Invariant clé** : dans Supabase, le code `{{ .Token }}` et le lien `{{ .TokenHash }}`
> sont le **même OTP** sous-jacent. Garder le lien réintroduit la faille (le scanner
> consomme le token partagé → le code meurt aussi). Les templates passent donc en
> **code-only**, lien retiré.

## Périmètre

**Dans le périmètre :**
- Confirmation d'inscription → code → auto-login `/dashboard`.
- Réinitialisation de mot de passe → écran unique (code + nouveau mot de passe).
- Nettoyage du doublon de page login (`/login` → page unique `/`).

**Hors périmètre :**
- Magic link (mockup `Prompts/email-magic-link-mockup.html` existe mais n'est branché nulle
  part dans l'UI).
- Changement d'adresse email (`type=email_change`) — chantier séparé.

## Décisions de design (validées)

| Sujet | Décision |
|-------|----------|
| Flux convertis | Inscription **et** reset MdP |
| Structure reset | **Écran unique combiné** (code + MdP + confirmation) |
| Doublon login | **Nettoyer** : `/login` redirige vers `/` |
| Architecture | **Tout inline dans `LoginForm`** (modes), pas de routes par étape |

Approche écartée — *garder lien + code* : non viable (OTP partagé, voir invariant).

## Architecture

Composant unique `web/components/auth/LoginForm.tsx` (rendu par `/` via `app/page.tsx`),
étendu en machine à états.

### Machine à états

```
Mode = 'login' | 'signup' | 'signupVerify' | 'forgot' | 'resetVerify'

login   ──signUp ok──────────────▶ signupVerify ──verifyOtp ok──▶ /dashboard
signup  ──signUp ok──────────────▶ signupVerify
forgot  ──resetPasswordForEmail──▶ resetVerify  ──verifyOtp + updateUser──▶ /dashboard
```

### Flux inscription

1. `supabase.auth.signUp({ email, password })` → Supabase envoie l'email « Confirm signup »
   (template code-only).
2. Passage en mode `signupVerify` (l'email saisi est conservé en state).
3. L'utilisateur recopie le code → `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
   - **À valider au plan** : `type: 'signup'` vs `'email'` selon la config « Confirm signup ».
4. Session établie → `router.push('/dashboard')` + `router.refresh()`.

### Flux reset de mot de passe

1. Mode `forgot` : saisie email → `supabase.auth.resetPasswordForEmail(email)` (template
   code-only ; l'option `redirectTo` devient inutile mais reste inoffensive).
2. Passage en mode `resetVerify` (email conservé en state).
3. Écran **combiné** : code + nouveau MdP + confirmation, validés ensemble :
   - `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` → session de récupération.
   - puis `supabase.auth.updateUser({ password })`.
4. → `router.push('/dashboard')` + `router.refresh()`.

### Composant `OtpCodeInput` (isolé)

Nouveau composant `web/components/auth/OtpCodeInput.tsx`, réutilisé par `signupVerify` et
`resetVerify`.

- **Interface** : `value: string`, `onChange(code: string)`, `onComplete?(code)`,
  `disabled?`, `length = 6`.
- **Dépendances** : aucune (champ contrôlé pur, pas d'appel Supabase).
- **Comportement** : 6 cases ; `inputMode="numeric"` ; `autoComplete="one-time-code"` ;
  collage d'un code complet réparti sur les cases ; navigation flèches/backspace.

### Renvoyer le code

Bouton « Renvoyer le code » sur les deux écrans de saisie, avec **cooldown UI ~45 s**
(timer local) pour respecter les rate-limits d'envoi Supabase.
- Inscription : `supabase.auth.resend({ type: 'signup', email })`.
- Reset : `supabase.auth.resetPasswordForEmail(email)` à nouveau.

### Nettoyage des routes

- `web/app/login/page.tsx` → remplacé par `redirect('/')` (suppression de la page plate
  dupliquée).
- `web/app/auth/reset/page.tsx` → remplacé par `redirect('/')` (les anciens liens de reset
  encore en vol ne cassent pas durement ; le nouveau flux est inline sur `/`).
- `web/app/auth/confirm/route.ts` → **laissé en place** mais inutilisé par ces flux (plus de
  liens). Resservira si magic link est branché un jour. Pas de suppression.

### Templates email (Supabase dashboard — manuel ⚠️)

Réécriture **code-only** de deux templates, charte « Deep Mission » (cohérente avec les
mockups existants `Prompts/email-*.html`) :
- « Confirm signup »
- « Reset Password »

Contenu : afficher uniquement `{{ .Token }}` (gros, lisible, copiable). **Retirer** tout
`{{ .ConfirmationURL }}` / `{{ .TokenHash }}` / lien cliquable.

Livrable : HTML déposé dans `Prompts/` (paste-ready). **Action manuelle de Franck** : coller
dans Supabase → Authentication → Email Templates. Ces templates ne sont **ni versionnés ni
auto-appliqués** ; cette spec ne les rend pas « live ».

### i18n

Nouvelles clés sous `auth` dans le provider i18n (`web/lib/i18n/…`) : titre « Entre le code
reçu », sous-titre (« Code à 6 chiffres envoyé à … »), label MdP reset, bouton « Vérifier »,
bouton « Renvoyer le code » + état cooldown, erreurs « code invalide » / « code expiré ».

### Gestion des erreurs

- Code invalide / expiré → message clair sous le champ + bouton « Renvoyer le code ».
- Tout étant inline (même onglet), l'ancien `?error=confirm` muet disparaît de fait.

## Tests

- `OtpCodeInput` : saisie chiffre à chiffre, collage d'un code complet, déclenchement
  `onComplete`, backspace/navigation.
- `LoginForm` (mocks `@supabase/ssr` browser client) :
  - inscription : `signUp` ok → mode `signupVerify` → `verifyOtp` ok → `router.push('/dashboard')`.
  - reset : `forgot` → `resetPasswordForEmail` → `resetVerify` → `verifyOtp` + `updateUser` → push.
  - erreur code : `verifyOtp` renvoie une erreur → message affiché, pas de navigation.
  - ⚠️ wrapper les tests dans `I18nProvider` (sinon `useT()` plante — cf. lessons jest i18n).
- Pas de test sur le HTML statique des templates email.

## Risques / points à valider au plan

1. **`type` exact du verifyOtp inscription** : `'signup'` attendu (config « Confirm
   signup ») ; à confirmer contre le comportement réel.
2. **flowType PKCE** : le client browser est en PKCE par défaut, mais
   `verifyOtp({ email, token, type })` (vérif par code) renvoie la session directement,
   **indépendamment du flowType** → pas de blocage attendu.
3. **Rate limits Supabase** sur l'envoi d'emails → cooldown UI obligatoire sur le renvoi.
4. **Confirmation email activée** côté Supabase : vérifier que « Confirm email » reste activé
   (sinon `signUp` connecte directement et l'étape code est court-circuitée — comportement
   acceptable, à noter).

## Documentation à mettre à jour

- `tasks/lessons.md` : la leçon prefetch/scanner (synthèse de cette spec).
- Mockups email dans `Prompts/` (nouveaux templates code-only).
