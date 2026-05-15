# Lessons Learned

Format : `[YYYY-MM-DD] | ce qui s'est mal passé | règle à suivre`

<!-- Les entrées les plus récentes en premier -->

[2026-05-15] | Bug « BottomNav non-tappable après drag-and-drop sur /charge » : j'ai cherché pendant plusieurs commits côté dnd-kit (cleanup styles, dropAnimation, PullToRefresh conflict) alors que la cause racine était dans `BlockGrid.useEffect` au mount. Le diag décisif a été quand Franck a clear son `localStorage.charge_block_order` : sans ordre custom, plus de bug. Le `setOrder()` synchrone au mount déclenche un re-render des 12 blocs (+5 charts Recharts) qui sature la file React, bloquant les transitions du router Next.js (`router.push` muet, `location.href` OK, pas de fetch pending). | Quand le router Next.js gèle après une interaction sur une page lourde, suspect immédiat = un `setState` urgent qui déclenche un gros re-render. Wrap dans `startTransition()` pour que React puisse l'interrompre. Vérifier aussi avec `localStorage.removeItem(...)` + reload pour isoler si l'état persisté est responsable.

[2026-05-14] | J'ai d'abord blâmé l'InstallPrompt (qui interceptait visuellement la BottomNav en Playwright) alors que le vrai bug chez Franck était un Service Worker servant des chunks JS obsolètes après un déploiement — `router.push()` muet, pas d'erreur, juste un router gelé. Le SW `VERSION` était hardcodé `'v2'` donc le cache ne s'invalidait jamais. | Quand un bug Next.js App Router se manifeste par « `router.push` ne navigue pas, `location.href` fonctionne, aucune erreur JS », tester EN PREMIER le clear site data (DevTools → Application → Storage → Clear). Si ça corrige → SW cache stale. La VERSION du SW doit être dérivée du SHA du commit, jamais hardcodée. Source de vérité : `web/scripts/sw.template.js` + `scripts/generate-sw.js` (auto-injecté par `scripts/build.js`).

