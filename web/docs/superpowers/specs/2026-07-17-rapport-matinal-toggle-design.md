# Réglage « Rapport matinal » — activer/désactiver l'auto-ouverture

> **Status: Implémenté** · 2026-07-17 · Code: `web/lib/preferences/morning-report.ts`, `web/components/settings/AppearanceSection.tsx`, `web/components/morning-report/MorningReportAutoOpen.tsx`

> Date : 2026-07-17 · Zone : Paramètres > Apparence

## Objectif

Permettre à l'utilisateur qui ne veut pas du rapport matinal de désactiver son
**auto-ouverture au lancement**, depuis le bloc **Apparence** de la page Réglages.

Portée retenue (décision Franck) : **auto-ouverture seulement**. Désactiver le
réglage supprime la redirection automatique vers `/rapport-matinal` à l'arrivée
sur `/dashboard`. La tuile `MorningReportTile` reste présente sur le Cockpit pour
ouvrir le rapport à la demande, et la page `/rapport-matinal` reste joignable.

## État existant

- `MorningReportAutoOpen` ([components/morning-report/MorningReportAutoOpen.tsx](../../../components/morning-report/MorningReportAutoOpen.tsx))
  est monté sur `/dashboard` et redirige une fois par jour vers `/rapport-matinal`
  (clé localStorage `morning_report_seen_<date>`), sauf le jour de la 1ʳᵉ connexion.
- `MorningReportTile` apparaît comme bloc `morningReport` du `DashboardGrid`
  (mode Expert, déjà masquable via les réglages de blocs) et en dur dans
  `MissionCockpit` (mode Simplifié). **Non touché** par cette feature.
- Les préférences UI sont synchronisées via `PreferencesProvider` : une liste
  `SYNCED_KEYS` de clés localStorage est poussée dans `profiles.ui_preferences`
  (JSONB), à l'image de `app_mode`. **Aucune migration Supabase nécessaire.**

## Comportement

- Interrupteur ON/OFF, **activé par défaut** (comportement actuel préservé).
- **ON** : redirection auto inchangée.
- **OFF** : plus de redirection auto. Tuile et page inchangées.

## Stockage

Nouvelle clé localStorage `morning_report_auto_open` (booléen sérialisé JSON),
ajoutée à `SYNCED_KEYS` → synchronisée dans `profiles.ui_preferences`
multi-appareils. Valeur absente = activé (défaut).

## Fiabilité de la décision de redirection

`MorningReportAutoOpen` décide dans un `useEffect` au montage. Pour éviter une
redirection parasite sur un nouvel appareil (préférence « OFF » réglée ailleurs,
pas encore hydratée en localStorage local), la valeur est aussi fournie par le
**SSR du dashboard** (lecture de `ui_preferences`).

Valeur effective utilisée par le composant :

```
const effective = localValue ?? initialAutoOpen ?? true
if (!effective) return   // pas de redirection
```

- `localValue` = `readMorningReportAutoOpen()` (localStorage, `null` si absent) —
  garantit la réactivité immédiate sur l'appareil qui vient de toggler.
- `initialAutoOpen` = prop SSR dérivée de `ui_preferences.morning_report_auto_open`
  (défaut `true`) — fiable au 1ᵉʳ rendu, avant hydratation cloud.

## Fichiers touchés

1. **`lib/preferences/morning-report.ts`** *(nouveau)* — calqué sur `app-mode.ts` :
   - `MORNING_REPORT_AUTO_OPEN_KEY = 'morning_report_auto_open'`
   - `readMorningReportAutoOpen(): boolean | null` (lit localStorage ; `null` si absent)
   - `writeMorningReportAutoOpen(enabled: boolean)` (écrit + `CustomEvent` même onglet)
   - hook `useMorningReportAutoOpen(): { enabled, setEnabled, mounted }`
     (init `true`, relit après montage, écoute event + `storage`, `notifyChange` au set)

2. **`lib/preferences/PreferencesProvider.tsx`** — ajouter
   `'morning_report_auto_open'` à `SYNCED_KEYS`.

3. **`components/morning-report/MorningReportAutoOpen.tsx`** — nouvelle prop
   `initialAutoOpen?: boolean` (défaut `true`) ; garde `if (!effective) return`
   dans le `useEffect` avant la redirection. Reste `'use client'`.

4. **`app/(main)/dashboard/page.tsx`** — ajouter `ui_preferences` au `select`
   profiles **déjà présent** (0 requête en plus), dériver
   `initialAutoOpen = prefs.morning_report_auto_open !== false`, le passer à
   `<MorningReportAutoOpen>`.

5. **`components/settings/AppearanceSection.tsx`** — switch row sous les chips
   thème/langue (libellé + hint + toggle, style repris de `StravaSection`
   `role="switch"`), branché sur `useMorningReportAutoOpen()`.

6. **`lib/i18n/dictionaries/fr.ts` & `en.ts`** — `settings.morningReportAutoOpenLabel`
   + `settings.morningReportAutoOpenHint`.

## Hors périmètre (YAGNI)

- Pas de masquage de la tuile ni de garde serveur sur `/rapport-matinal`.
- Pas de migration Supabase (réutilise `ui_preferences`).
- Pas de nouveau endpoint API (sync via `PreferencesProvider` existant).

## Vérification

- `npx tsc --noEmit` (type-check) + `npm run lint`.
- Test manuel : Réglages → Apparence → toggle OFF → recharger `/dashboard` :
  aucune redirection. Toggle ON → redirection au 1ᵉʳ chargement du jour.
