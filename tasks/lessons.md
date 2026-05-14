# Lessons Learned

Format : `[YYYY-MM-DD] | ce qui s'est mal passé | règle à suivre`

<!-- Les entrées les plus récentes en premier -->

[2026-05-14] | J'ai d'abord blâmé l'InstallPrompt (qui interceptait visuellement la BottomNav en Playwright) alors que le vrai bug chez Franck était un Service Worker servant des chunks JS obsolètes après un déploiement — `router.push()` muet, pas d'erreur, juste un router gelé. Le SW `VERSION` était hardcodé `'v2'` donc le cache ne s'invalidait jamais. | Quand un bug Next.js App Router se manifeste par « `router.push` ne navigue pas, `location.href` fonctionne, aucune erreur JS », tester EN PREMIER le clear site data (DevTools → Application → Storage → Clear). Si ça corrige → SW cache stale. La VERSION du SW doit être dérivée du SHA du commit, jamais hardcodée. Source de vérité : `web/scripts/sw.template.js` + `scripts/generate-sw.js` (auto-injecté par `scripts/build.js`).

