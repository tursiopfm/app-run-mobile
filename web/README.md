# Trail Cockpit Web

Web app mobile-first pour le suivi d'entraînement trail / endurance.

## Stack

- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS 3
- Supabase (auth + DB)
- Recharts (graphiques)

## Installation

```bash
cd web
npm install
```

## Lancer en local

1. Copier les variables d'env :

```bash
cp .env.example .env.local
```

2. Remplir `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abc...
STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback
STRAVA_WEBHOOK_VERIFY_TOKEN=trail_cockpit_webhook_secret
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Démarrer :

```bash
npm run dev
```

App disponible sur : http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

## Tester sur mobile avec ngrok

```bash
ngrok http 3000
```

Puis mettre à jour `.env.local` :

```env
APP_URL=https://xxx.ngrok-free.app
NEXT_PUBLIC_APP_URL=https://xxx.ngrok-free.app
STRAVA_REDIRECT_URI=https://xxx.ngrok-free.app/api/strava/callback
```
