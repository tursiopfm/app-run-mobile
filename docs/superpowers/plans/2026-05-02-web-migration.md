> **Status: Implémenté** · Date: 2026-05-02 · Code: `web/` (toute l'arborescence Next.js)
> *Snapshot de design — pour l'état actuel, voir le code.*

# Trail Cockpit Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Next.js 14 web app in `web/` that reproduces Trail Cockpit's dashboard, activities, and analytics as a mobile-first PWA, leaving the Android project and Node.js backend completely untouched.

**Architecture:** App Router + TypeScript, Tailwind CSS for a dark trail-sport theme, Supabase for auth + database, Route Handlers for Strava OAuth + webhooks, pure-function analytics layer (CES + EWMA) ported from the Kotlin CesCalculator and the Blueprint TypeScript pseudocode.

**Tech Stack:** Next.js 14, TypeScript 5, Tailwind CSS 3, @supabase/ssr, Recharts, Lucide React, Jest + Testing Library

---

## Audit Summary (Mission 1 — completed pre-plan)

| What | Where | Status |
|---|---|---|
| Android app (Kotlin + Compose) | `app/` | Untouched |
| Node.js backend (SQLite, no framework) | `backend/strava-oauth/server.js` | Reference only |
| Strava OAuth flow | `GET /api/strava/connect` → `GET /api/strava/callback` | To port to Next.js |
| Strava webhook | `GET|POST /api/strava/webhook` | To port to Next.js |
| Dashboard computation (EWMA ATL/CTL/TSB) | `buildDashboardFromActivities()` in server.js | To port to `lib/analytics/` |
| CES calculator (Kotlin) | `CesCalculator.kt` | To port to `lib/analytics/effort-score.ts` |
| EWMA training load (Kotlin) | `TrainingLoadCalculator.kt` | To port to `lib/analytics/fatigue.ts` |
| Blueprint (math model) | `docs/BLUEPRINT_COCKPIT_TRAIL_CHARGE_EFFORT_MULTISPORT.md` | TypeScript pseudocode ready to use |
| Auth (email/password, JWT sessions) | `server.js` handleAuthRegister/Login | Replace with Supabase Auth |
| SQLite storage | `backend/strava-oauth/data/trail.db` | Replace with Supabase (Postgres) |

**What NOT to touch:** `app/`, `backend/`, `gradle/`, `build.gradle.kts`, `settings.gradle.kts`, `.gradle/`, `tools/`

---

## File Map

### Config & Bootstrap
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/.env.example`
- Create: `web/.eslintrc.json`

### App Layer
- Create: `web/app/globals.css`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/dashboard/page.tsx`
- Create: `web/app/activities/page.tsx`
- Create: `web/app/coach/page.tsx`
- Create: `web/app/settings/page.tsx`
- Create: `web/app/admin/page.tsx`

### API Routes
- Create: `web/app/api/strava/connect/route.ts`
- Create: `web/app/api/strava/callback/route.ts`
- Create: `web/app/api/webhooks/strava/route.ts`

### Components
- Create: `web/components/navigation/BottomNav.tsx`
- Create: `web/components/navigation/AppShell.tsx`
- Create: `web/components/ui/KpiCard.tsx`
- Create: `web/components/ui/LoadChart.tsx`

### Library
- Create: `web/lib/database/supabase-client.ts`
- Create: `web/lib/database/supabase-server.ts`
- Create: `web/lib/providers/strava/auth.ts`
- Create: `web/lib/providers/strava/mapper.ts`
- Create: `web/lib/providers/strava/webhook.ts`
- Create: `web/lib/providers/garmin/index.ts`   ← skeleton
- Create: `web/lib/providers/polar/index.ts`    ← skeleton
- Create: `web/lib/providers/suunto/index.ts`   ← skeleton
- Create: `web/lib/analytics/types.ts`
- Create: `web/lib/analytics/effort-score.ts`
- Create: `web/lib/analytics/fatigue.ts`
- Create: `web/lib/analytics/load.ts`
- Create: `web/lib/analytics/ultra-ready.ts`

### Database
- Create: `web/supabase/migrations/001_initial_schema.sql`
- Create: `web/supabase/migrations/002_rls_policies.sql`

### Tests
- Create: `web/jest.config.js`
- Create: `web/jest.setup.ts`
- Create: `web/__tests__/analytics/effort-score.test.ts`
- Create: `web/__tests__/analytics/fatigue.test.ts`
- Create: `web/__tests__/providers/strava-mapper.test.ts`

### PWA
- Create: `web/public/manifest.json`
- Create: `web/public/icons/.gitkeep`

### Docs
- Create: `web/README.md`

---

## Task 1: Bootstrap Next.js project

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/.eslintrc.json`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "trail-cockpit-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest --passWithNoTests",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "next": "14.2.29",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.49.4",
    "recharts": "^2.12.7",
    "lucide-react": "^0.469.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/node": "^22.10.1",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "eslint": "^8.57.1",
    "eslint-config-next": "14.2.29",
    "jest": "^29.7.0",
    "@jest/globals": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "ts-jest": "^29.2.5",
    "@types/jest": "^29.5.14"
  }
}
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `web/next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 4: Create `web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        trail: {
          bg:           '#0f1117',
          surface:      '#1a1d2e',
          card:         '#1e2235',
          border:       '#2a2f45',
          muted:        '#6b7280',
          text:         '#e8eaf0',
          primary:      '#f97316',
          'primary-dim':'#c2410c',
          accent:       '#22d3ee',
          success:      '#4ade80',
          warning:      '#facc15',
          danger:       '#f87171',
        },
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Create `web/postcss.config.mjs`**

```js
/** @type {import('postcss').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
export default config
```

- [ ] **Step 6: Create `web/.eslintrc.json`**

```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/tsconfig.json web/next.config.ts web/tailwind.config.ts web/postcss.config.mjs web/.eslintrc.json
git commit -m "feat(web): bootstrap Next.js 14 project configuration"
```

---

## Task 2: App shell + global styles

**Files:**
- Create: `web/app/globals.css`
- Create: `web/app/layout.tsx`
- Create: `web/.env.example`

- [ ] **Step 1: Create `web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #0f1117;
  color: #e8eaf0;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior: none;
}

.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #1a1d2e; }
::-webkit-scrollbar-thumb { background: #2a2f45; border-radius: 2px; }
```

- [ ] **Step 2: Create `web/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trail Cockpit',
  description: 'Your trail running dashboard',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Trail Cockpit',
  },
}

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-trail-bg text-trail-text min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create `web/.env.example`**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Strava
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback
STRAVA_WEBHOOK_VERIFY_TOKEN=trail_cockpit_webhook_secret

# OpenAI (Coach IA)
OPENAI_API_KEY=

# App
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/app/layout.tsx web/.env.example
git commit -m "feat(web): app shell layout and global styles"
```

---

## Task 3: Supabase clients

**Files:**
- Create: `web/lib/database/supabase-client.ts`
- Create: `web/lib/database/supabase-server.ts`

- [ ] **Step 1: Create `web/lib/database/supabase-client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create `web/lib/database/supabase-server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/database/
git commit -m "feat(web): Supabase browser and server clients"
```

---

## Task 4: Database migrations

**Files:**
- Create: `web/supabase/migrations/001_initial_schema.sql`
- Create: `web/supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Create `web/supabase/migrations/001_initial_schema.sql`**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table if not exists profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text unique not null,
  first_name    text,
  last_name     text,
  avatar_url    text,
  year_goal_km  integer default 3000,
  weight_kg     numeric(5,1),
  resting_hr    integer,
  max_hr        integer,
  threshold_hr  integer,
  ftp_watts     integer,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Provider connections — generic: strava, garmin, polar, suunto, coros, fit_file
create table if not exists provider_connections (
  id               uuid default uuid_generate_v4() primary key,
  user_id          uuid references profiles(id) on delete cascade not null,
  provider         text not null check (provider in ('strava','garmin','polar','suunto','coros','fit_file')),
  provider_user_id text,
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  scope            text,
  athlete_data     jsonb,
  connected_at     timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (user_id, provider)
);

-- Activities — normalized, multi-provider
create table if not exists activities (
  id                    uuid default uuid_generate_v4() primary key,
  user_id               uuid references profiles(id) on delete cascade not null,
  provider              text not null,
  provider_activity_id  text not null,
  sport_type            text not null,
  name                  text,
  start_time            timestamptz not null,
  duration_sec          integer not null default 0,
  moving_time_sec       integer not null default 0,
  distance_m            numeric(10,1) default 0,
  elevation_gain_m      numeric(8,1) default 0,
  avg_hr                integer,
  max_hr                integer,
  avg_power             integer,
  calories              integer,
  external_training_load numeric(8,2),
  ces                   numeric(8,2),
  raw_payload           jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (user_id, provider, provider_activity_id)
);
create index if not exists idx_activities_user_start on activities(user_id, start_time desc);

-- Activity metrics (per-activity computed values)
create table if not exists activity_metrics (
  id           uuid default uuid_generate_v4() primary key,
  activity_id  uuid references activities(id) on delete cascade not null,
  metric_key   text not null,
  metric_value numeric(12,4),
  computed_at  timestamptz default now(),
  unique (activity_id, metric_key)
);

-- Daily metrics (EWMA ATL/CTL/TSB per user per day)
create table if not exists daily_metrics (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  metric_date date not null,
  atl         numeric(8,2),
  ctl         numeric(8,2),
  tsb         numeric(8,2),
  daily_load  numeric(8,2),
  computed_at timestamptz default now(),
  unique (user_id, metric_date)
);
create index if not exists idx_daily_metrics_user_date on daily_metrics(user_id, metric_date desc);

-- Weekly metrics (snapshot end-of-week)
create table if not exists weekly_metrics (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references profiles(id) on delete cascade not null,
  week_start   date not null,
  run_km       numeric(8,2),
  run_dplus    integer,
  ride_km      numeric(8,2),
  swim_km      numeric(8,2),
  total_ces    numeric(8,2),
  atl_snapshot numeric(8,2),
  ctl_snapshot numeric(8,2),
  tsb_snapshot numeric(8,2),
  computed_at  timestamptz default now(),
  unique (user_id, week_start)
);

-- Webhook events (raw, fast insert, async processing)
create table if not exists webhook_events (
  id          uuid default uuid_generate_v4() primary key,
  provider    text not null,
  event_type  text,
  object_type text,
  object_id   text,
  owner_id    text,
  raw_payload jsonb not null,
  received_at timestamptz default now(),
  processed   boolean default false
);
create index if not exists idx_webhook_unprocessed on webhook_events(provider, processed, received_at);

-- Sync jobs (async processing queue)
create table if not exists sync_jobs (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references profiles(id) on delete set null,
  provider    text not null,
  job_type    text not null,
  status      text not null default 'pending'
              check (status in ('pending','running','done','error')),
  payload     jsonb,
  error_msg   text,
  created_at  timestamptz default now(),
  started_at  timestamptz,
  finished_at timestamptz
);
create index if not exists idx_sync_jobs_status on sync_jobs(status, created_at);

-- Coach messages (chat history)
create table if not exists coach_messages (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  role       text not null check (role in ('user','assistant','system')),
  content    text not null,
  model      text,
  created_at timestamptz default now()
);
create index if not exists idx_coach_messages_user on coach_messages(user_id, created_at desc);

-- Admin logs
create table if not exists admin_logs (
  id          uuid default uuid_generate_v4() primary key,
  actor_id    uuid,
  action      text not null,
  target_type text,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz default now()
);
```

- [ ] **Step 2: Create `web/supabase/migrations/002_rls_policies.sql`**

```sql
-- Enable RLS
alter table profiles              enable row level security;
alter table provider_connections  enable row level security;
alter table activities            enable row level security;
alter table activity_metrics      enable row level security;
alter table daily_metrics         enable row level security;
alter table weekly_metrics        enable row level security;
alter table webhook_events        enable row level security;
alter table sync_jobs             enable row level security;
alter table coach_messages        enable row level security;
alter table admin_logs            enable row level security;

-- profiles: own row only
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- provider_connections: own rows only
create policy "pconn_select_own" on provider_connections for select using (auth.uid() = user_id);
create policy "pconn_insert_own" on provider_connections for insert with check (auth.uid() = user_id);
create policy "pconn_update_own" on provider_connections for update using (auth.uid() = user_id);
create policy "pconn_delete_own" on provider_connections for delete using (auth.uid() = user_id);

-- activities: own rows only
create policy "activities_select_own" on activities for select using (auth.uid() = user_id);
create policy "activities_insert_own" on activities for insert with check (auth.uid() = user_id);
create policy "activities_update_own" on activities for update using (auth.uid() = user_id);

-- daily_metrics: own rows only
create policy "daily_metrics_select_own" on daily_metrics for select using (auth.uid() = user_id);

-- weekly_metrics: own rows only
create policy "weekly_metrics_select_own" on weekly_metrics for select using (auth.uid() = user_id);

-- coach_messages: own rows only
create policy "coach_messages_select_own" on coach_messages for select using (auth.uid() = user_id);
create policy "coach_messages_insert_own" on coach_messages for insert with check (auth.uid() = user_id);

-- webhook_events, sync_jobs, admin_logs: service role only (no user-level access)
-- These tables have RLS enabled but no permissive user policies;
-- all access goes through createServiceClient() server-side.
```

- [ ] **Step 3: Commit**

```bash
git add web/supabase/
git commit -m "feat(web): Supabase schema — profiles, activities, metrics, webhooks, sync_jobs"
```

---

## Task 5: NormalizedActivity type + Strava mapper

**Files:**
- Create: `web/lib/providers/strava/mapper.ts`
- Create: `web/lib/providers/garmin/index.ts`
- Create: `web/lib/providers/polar/index.ts`
- Create: `web/lib/providers/suunto/index.ts`
- Test: `web/__tests__/providers/strava-mapper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/providers/strava-mapper.test.ts`:

```ts
import { stravaToNormalized, type StravaActivity } from '@/lib/providers/strava/mapper'

const MOCK_STRAVA: StravaActivity = {
  id: 12345,
  name: 'Morning Trail Run',
  type: 'Run',
  sport_type: 'Run',
  start_date: '2026-05-02T07:00:00Z',
  start_date_local: '2026-05-02T09:00:00',
  moving_time: 3600,
  elapsed_time: 3700,
  distance: 15000,
  total_elevation_gain: 400,
  average_heartrate: 155,
  max_heartrate: 175,
  calories: 820,
}

describe('stravaToNormalized', () => {
  it('maps core fields correctly', () => {
    const result = stravaToNormalized('user-123', MOCK_STRAVA)
    expect(result.provider).toBe('strava')
    expect(result.providerActivityId).toBe('12345')
    expect(result.sportType).toBe('Run')
    expect(result.distanceM).toBe(15000)
    expect(result.durationSec).toBe(3700)
    expect(result.movingTimeSec).toBe(3600)
    expect(result.elevationGainM).toBe(400)
    expect(result.avgHr).toBe(155)
    expect(result.maxHr).toBe(175)
    expect(result.calories).toBe(820)
  })

  it('preserves raw payload', () => {
    const result = stravaToNormalized('user-123', MOCK_STRAVA)
    const raw = result.rawPayload as StravaActivity
    expect(raw.id).toBe(12345)
  })

  it('uses start_date_local when available', () => {
    const result = stravaToNormalized('user-123', MOCK_STRAVA)
    expect(result.startTime).toBe('2026-05-02T09:00:00')
  })

  it('falls back to start_date when no local date', () => {
    const a: StravaActivity = { ...MOCK_STRAVA, start_date_local: undefined }
    const result = stravaToNormalized('user-123', a)
    expect(result.startTime).toBe('2026-05-02T07:00:00Z')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx jest __tests__/providers/strava-mapper.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/providers/strava/mapper'`

- [ ] **Step 3: Create `web/lib/providers/strava/mapper.ts`**

```ts
export type NormalizedActivity = {
  userId: string
  provider: string
  providerActivityId: string
  sportType: string
  name: string
  startTime: string
  durationSec: number
  movingTimeSec: number
  distanceM: number
  elevationGainM: number
  avgHr: number | null
  maxHr: number | null
  avgPower: number | null
  calories: number | null
  externalTrainingLoad: number | null
  rawPayload: unknown
}

export type StravaActivity = {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  start_date_local?: string
  moving_time: number
  elapsed_time: number
  distance: number
  total_elevation_gain: number
  average_heartrate?: number
  max_heartrate?: number
  average_watts?: number
  weighted_average_watts?: number
  suffer_score?: number
  kilojoules?: number
  calories?: number
}

export function stravaToNormalized(userId: string, a: StravaActivity): NormalizedActivity {
  return {
    userId,
    provider: 'strava',
    providerActivityId: String(a.id),
    sportType: a.sport_type || a.type,
    name: a.name,
    startTime: a.start_date_local ?? a.start_date,
    durationSec: a.elapsed_time,
    movingTimeSec: a.moving_time,
    distanceM: a.distance,
    elevationGainM: a.total_elevation_gain,
    avgHr: a.average_heartrate ?? null,
    maxHr: a.max_heartrate ?? null,
    avgPower: a.weighted_average_watts ?? a.average_watts ?? null,
    calories: a.calories ?? null,
    externalTrainingLoad: a.suffer_score ?? null,
    rawPayload: a,
  }
}
```

- [ ] **Step 4: Create skeleton provider files**

Create `web/lib/providers/garmin/index.ts`:
```ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type GarminActivity = Record<string, unknown>

export function garminToNormalized(_userId: string, _a: GarminActivity): NormalizedActivity {
  throw new Error('Garmin provider not yet implemented')
}
```

Create `web/lib/providers/polar/index.ts`:
```ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type PolarActivity = Record<string, unknown>

export function polarToNormalized(_userId: string, _a: PolarActivity): NormalizedActivity {
  throw new Error('Polar provider not yet implemented')
}
```

Create `web/lib/providers/suunto/index.ts`:
```ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type SuuntoActivity = Record<string, unknown>

export function suuntoToNormalized(_userId: string, _a: SuuntoActivity): NormalizedActivity {
  throw new Error('Suunto provider not yet implemented')
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd web && npx jest __tests__/providers/strava-mapper.test.ts
```
Expected: 4/4 PASS

- [ ] **Step 6: Commit**

```bash
git add web/lib/providers/ web/__tests__/providers/
git commit -m "feat(web): NormalizedActivity type and Strava → NormalizedActivity mapper"
```

---

## Task 6: Analytics types + effort-score.ts (CES port)

Port the CES (Cockpit Effort Score) logic from `CesCalculator.kt` and the Blueprint TypeScript pseudocode in `docs/BLUEPRINT_COCKPIT_TRAIL_CHARGE_EFFORT_MULTISPORT.md`.

**Files:**
- Create: `web/lib/analytics/types.ts`
- Create: `web/lib/analytics/effort-score.ts`
- Test: `web/__tests__/analytics/effort-score.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/analytics/effort-score.test.ts`:

```ts
import { computeCes, computeCesResult, normalizeSportType, type ActivityInput } from '@/lib/analytics/effort-score'

const BASE_RUN: ActivityInput = {
  id: '1',
  rawSportType: 'Run',
  name: 'Morning Run',
  startDate: '2026-05-02',
  movingTimeSeconds: 3600,
  distanceMeters: 12000,
  elevationGainMeters: 0,
}

describe('normalizeSportType', () => {
  it('maps Run → run',          () => expect(normalizeSportType('Run')).toBe('run'))
  it('maps TrailRun → trail_run',() => expect(normalizeSportType('TrailRun')).toBe('trail_run'))
  it('maps VirtualRide → indoor_ride', () => expect(normalizeSportType('VirtualRide')).toBe('indoor_ride'))
  it('maps Swim → swim',         () => expect(normalizeSportType('Swim')).toBe('swim'))
  it('maps unknown → other',     () => expect(normalizeSportType('WeirdSport')).toBe('other'))
  it('uses name for trail hint', () => expect(normalizeSportType('Run', 'Trail du matin')).toBe('trail_run'))
})

describe('computeCes', () => {
  it('returns positive score for a 1-hour run at threshold pace', () => {
    const ces = computeCes({ ...BASE_RUN, movingTimeSeconds: 3600, distanceMeters: 12000 })
    expect(ces).toBeGreaterThan(50)
    expect(ces).toBeLessThan(200)
  })

  it('longer activity has higher CES than shorter', () => {
    const short = computeCes({ ...BASE_RUN, movingTimeSeconds: 1800, distanceMeters: 6000 })
    const long  = computeCes({ ...BASE_RUN, movingTimeSeconds: 7200, distanceMeters: 24000 })
    expect(long).toBeGreaterThan(short)
  })

  it('elevation increases CES for trail', () => {
    const flat  = computeCes({ ...BASE_RUN, rawSportType: 'TrailRun', elevationGainMeters: 0 })
    const hilly = computeCes({ ...BASE_RUN, rawSportType: 'TrailRun', elevationGainMeters: 1000 })
    expect(hilly).toBeGreaterThan(flat)
  })

  it('returns > 0 for minimal activity', () => {
    expect(computeCes({ ...BASE_RUN, movingTimeSeconds: 300, distanceMeters: 1000 })).toBeGreaterThan(0)
  })
})

describe('computeCesResult', () => {
  it('returns a label', () => {
    const r = computeCesResult(BASE_RUN)
    expect(['recovery','endurance','steady','intense','very_hard','extreme']).toContain(r.label)
  })

  it('cardioLoad and muscleLoad are positive', () => {
    const r = computeCesResult(BASE_RUN)
    expect(r.cardioLoad).toBeGreaterThan(0)
    expect(r.muscleLoad).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx jest __tests__/analytics/effort-score.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/analytics/effort-score'`

- [ ] **Step 3: Create `web/lib/analytics/types.ts`**

```ts
export type SportCategory =
  | 'run' | 'trail_run' | 'walk' | 'hike'
  | 'road_ride' | 'gravel_ride' | 'mountain_bike' | 'indoor_ride'
  | 'swim' | 'strength' | 'mobility' | 'cardio_other' | 'other'

export type EffortLabel =
  | 'recovery' | 'endurance' | 'steady' | 'intense' | 'very_hard' | 'extreme'

export type ActivityInput = {
  id: string
  rawSportType: string
  name?: string
  startDate: string
  movingTimeSeconds: number
  elapsedTimeSeconds?: number
  distanceMeters?: number
  elevationGainMeters?: number
  averageHeartrate?: number
  maxHeartrate?: number
  averageWatts?: number
  normalizedPowerWatts?: number
  calories?: number
  perceivedEffort?: number
}

export type CesResult = {
  ces: number
  cardioLoad: number
  muscleLoad: number
  label: EffortLabel
  intensityFactor: number
}

export type SportConfig = {
  sportBase: number
  sportFactor: number
  defaultIF: number
  minIF: number
  maxIF: number
  elevationSensitivity: number
  thresholdPaceSecPerKm: number | null
  thresholdPower: number | null
}
```

- [ ] **Step 4: Create `web/lib/analytics/effort-score.ts`**

```ts
import type { ActivityInput, CesResult, EffortLabel, SportCategory, SportConfig } from './types'

const SPORT_CONFIGS: Record<SportCategory, SportConfig> = {
  run:          { sportBase: 100, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 8,  thresholdPaceSecPerKm: 300, thresholdPower: null },
  trail_run:    { sportBase: 100, sportFactor: 1.15, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 12, thresholdPaceSecPerKm: 330, thresholdPower: null },
  walk:         { sportBase:  60, sportFactor: 0.50, defaultIF: 0.50, minIF: 0.3, maxIF: 0.8, elevationSensitivity: 10, thresholdPaceSecPerKm: null, thresholdPower: null },
  hike:         { sportBase:  60, sportFactor: 0.65, defaultIF: 0.55, minIF: 0.3, maxIF: 0.9, elevationSensitivity: 14, thresholdPaceSecPerKm: null, thresholdPower: null },
  road_ride:    { sportBase:  80, sportFactor: 0.75, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 5,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  gravel_ride:  { sportBase:  80, sportFactor: 0.85, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 7,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  mountain_bike:{ sportBase:  90, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 9,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  indoor_ride:  { sportBase:  80, sportFactor: 0.70, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  swim:         { sportBase: 120, sportFactor: 1.10, defaultIF: 0.75, minIF: 0.4, maxIF: 1.2, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  strength:     { sportBase:  80, sportFactor: 0.90, defaultIF: 0.70, minIF: 0.4, maxIF: 1.1, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  mobility:     { sportBase:  40, sportFactor: 0.40, defaultIF: 0.50, minIF: 0.2, maxIF: 0.7, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  cardio_other: { sportBase:  80, sportFactor: 0.80, defaultIF: 0.65, minIF: 0.3, maxIF: 1.1, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  other:        { sportBase:  70, sportFactor: 0.70, defaultIF: 0.60, minIF: 0.3, maxIF: 1.0, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
}

export function normalizeSportType(rawSportType: string, name?: string): SportCategory {
  const raw   = rawSportType.toLowerCase()
  const title = (name ?? '').toLowerCase()
  if (raw.includes('trail'))                                                    return 'trail_run'
  if (raw.includes('run'))       return title.includes('trail') ? 'trail_run' : 'run'
  if (raw.includes('walk'))                                                     return 'walk'
  if (raw.includes('hike'))                                                     return 'hike'
  if (raw.includes('gravel'))                                                   return 'gravel_ride'
  if (raw.includes('mountain') || raw.includes('mtb'))                          return 'mountain_bike'
  if (raw.includes('virtualride') || raw.includes('indoor') || raw.includes('trainer')) return 'indoor_ride'
  if (raw.includes('ride') || raw.includes('bike') || raw.includes('cycling'))  return 'road_ride'
  if (raw.includes('swim'))                                                     return 'swim'
  if (raw.includes('strength') || raw.includes('weight') || raw.includes('muscu')) return 'strength'
  if (raw.includes('yoga') || raw.includes('mobility') || raw.includes('stretch')) return 'mobility'
  return 'other'
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function effortLabel(ces: number): EffortLabel {
  if (ces <= 30)  return 'recovery'
  if (ces <= 60)  return 'endurance'
  if (ces <= 90)  return 'steady'
  if (ces <= 130) return 'intense'
  if (ces <= 180) return 'very_hard'
  return 'extreme'
}

function calcIF(a: ActivityInput, cfg: SportConfig): number {
  if (cfg.thresholdPaceSecPerKm && a.distanceMeters && a.distanceMeters > 200 && a.movingTimeSeconds > 0) {
    const paceSecPerKm = a.movingTimeSeconds / (a.distanceMeters / 1000)
    return clamp(cfg.thresholdPaceSecPerKm / paceSecPerKm, cfg.minIF, cfg.maxIF)
  }
  if (cfg.thresholdPower && a.normalizedPowerWatts) {
    return clamp(a.normalizedPowerWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF)
  }
  if (cfg.thresholdPower && a.averageWatts) {
    return clamp(a.averageWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF)
  }
  return cfg.defaultIF
}

function calcElevationFactor(a: ActivityInput, cfg: SportConfig): number {
  if (cfg.elevationSensitivity <= 0 || !a.distanceMeters || a.distanceMeters <= 0) return 1.0
  const gain       = a.elevationGainMeters ?? 0
  const per100m    = (gain / a.distanceMeters) * 100
  return 1.0 + per100m * cfg.elevationSensitivity * 0.01
}

export function computeCesResult(a: ActivityInput): CesResult {
  const durationHours = Math.max(a.movingTimeSeconds / 3600, 0.01)
  const sport         = normalizeSportType(a.rawSportType, a.name)
  const cfg           = SPORT_CONFIGS[sport]
  const IF            = calcIF(a, cfg)
  const elevFactor    = calcElevationFactor(a, cfg)
  const baseScore     = durationHours * cfg.sportBase * (IF * IF)
  const finalScore    = baseScore * cfg.sportFactor * elevFactor
  return {
    ces:             Math.round(finalScore),
    cardioLoad:      Math.round(baseScore * cfg.sportFactor),
    muscleLoad:      Math.round(finalScore * 0.6),
    label:           effortLabel(finalScore),
    intensityFactor: Math.round(IF * 100) / 100,
  }
}

export function computeCes(a: ActivityInput): number {
  return computeCesResult(a).ces
}

export type { ActivityInput, CesResult, EffortLabel, SportCategory }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd web && npx jest __tests__/analytics/effort-score.test.ts
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add web/lib/analytics/types.ts web/lib/analytics/effort-score.ts web/__tests__/analytics/effort-score.test.ts
git commit -m "feat(web): analytics effort-score — CES calculator (port from Kotlin CesCalculator + Blueprint)"
```

---

## Task 7: Analytics — fatigue, load, ultra-ready

**Files:**
- Create: `web/lib/analytics/fatigue.ts`
- Create: `web/lib/analytics/load.ts`
- Create: `web/lib/analytics/ultra-ready.ts`
- Test: `web/__tests__/analytics/fatigue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/analytics/fatigue.test.ts`:

```ts
import { computeEwma, buildDailyMetrics, type DailyLoad } from '@/lib/analytics/fatigue'

function makeLoads(days: number, cesPerDay: number): DailyLoad[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date('2026-01-01')
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], ces: cesPerDay }
  })
}

describe('computeEwma', () => {
  it('initializes to first day CES', () => {
    const result = computeEwma(makeLoads(5, 100), 7)
    expect(result[0].ewma).toBeCloseTo(100, 0)
  })

  it('converges toward steady-state CES', () => {
    const result = computeEwma(makeLoads(60, 80), 7)
    expect(result[result.length - 1].ewma).toBeGreaterThan(70)
    expect(result[result.length - 1].ewma).toBeLessThan(85)
  })
})

describe('buildDailyMetrics', () => {
  it('TSB equals CTL minus ATL', () => {
    const result = buildDailyMetrics(makeLoads(30, 50))
    const last = result[result.length - 1]
    expect(last.tsb).toBeCloseTo(last.ctl - last.atl, 1)
  })

  it('fills gaps between sparse dates with 0 CES', () => {
    const loads: DailyLoad[] = [
      { date: '2026-01-01', ces: 100 },
      { date: '2026-01-05', ces: 80 },
    ]
    const result = buildDailyMetrics(loads)
    expect(result.length).toBe(5)
    expect(result[1].dailyLoad).toBe(0)
  })

  it('ATL is more reactive than CTL', () => {
    const loads = [
      ...makeLoads(20, 50),
      ...Array.from({ length: 10 }, (_, i) => ({
        date: new Date(new Date('2026-01-21').getTime() + i * 86400000).toISOString().split('T')[0],
        ces: 200,
      })),
    ]
    const result = buildDailyMetrics(loads)
    const last = result[result.length - 1]
    expect(last.atl).toBeGreaterThan(last.ctl)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx jest __tests__/analytics/fatigue.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `web/lib/analytics/fatigue.ts`**

```ts
export type DailyLoad = {
  date: string
  ces: number
}

export type DailyMetrics = {
  date: string
  dailyLoad: number
  atl: number
  ctl: number
  tsb: number
}

export type EwmaPoint = {
  date: string
  ewma: number
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function fillConsecutiveDays(loads: DailyLoad[]): DailyLoad[] {
  if (loads.length === 0) return []
  const sorted = [...loads].sort((a, b) => a.date.localeCompare(b.date))
  const map    = new Map(sorted.map((l) => [l.date, l.ces]))
  const result: DailyLoad[] = []
  let cur = sorted[0].date
  const end = sorted[sorted.length - 1].date
  while (cur <= end) {
    result.push({ date: cur, ces: map.get(cur) ?? 0 })
    cur = nextDay(cur)
  }
  return result
}

export function computeEwma(loads: DailyLoad[], periodDays: number): EwmaPoint[] {
  const filled = fillConsecutiveDays(loads)
  if (filled.length === 0) return []
  const alpha = 1 - Math.exp(-1 / periodDays)
  let ewma = filled[0].ces
  return filled.map((d, i) => {
    if (i > 0) ewma = ewma + alpha * (d.ces - ewma)
    return { date: d.date, ewma }
  })
}

export function buildDailyMetrics(loads: DailyLoad[]): DailyMetrics[] {
  const filled   = fillConsecutiveDays(loads)
  if (filled.length === 0) return []
  const alphaAtl = 1 - Math.exp(-1 / 7)
  const alphaCtl = 1 - Math.exp(-1 / 42)
  let atl = filled[0].ces
  let ctl = filled[0].ces
  return filled.map((d, i) => {
    if (i > 0) {
      atl = atl + alphaAtl * (d.ces - atl)
      ctl = ctl + alphaCtl * (d.ces - ctl)
    }
    return {
      date:      d.date,
      dailyLoad: d.ces,
      atl:       Math.round(atl * 10) / 10,
      ctl:       Math.round(ctl * 10) / 10,
      tsb:       Math.round((ctl - atl) * 10) / 10,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx jest __tests__/analytics/fatigue.test.ts
```
Expected: All PASS

- [ ] **Step 5: Create `web/lib/analytics/load.ts`**

```ts
import { computeCes, type ActivityInput } from './effort-score'
import type { DailyLoad } from './fatigue'

export function aggregateToDailyLoad(activities: ActivityInput[]): DailyLoad[] {
  const map = new Map<string, number>()
  for (const a of activities) {
    const date = a.startDate.split('T')[0]
    map.set(date, (map.get(date) ?? 0) + computeCes(a))
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ces]) => ({ date, ces }))
}
```

- [ ] **Step 6: Create `web/lib/analytics/ultra-ready.ts`**

```ts
import type { DailyMetrics } from './fatigue'

export type UltraReadyScore = {
  score: number
  label: 'not_ready' | 'building' | 'approaching' | 'ready' | 'peak'
  freshness: number
  fitnessLevel: number
  loadRatio: number
}

export function computeUltraReady(metrics: DailyMetrics[], targetDate?: string): UltraReadyScore {
  if (metrics.length === 0) {
    return { score: 0, label: 'not_ready', freshness: 0, fitnessLevel: 0, loadRatio: 1 }
  }
  const latest = targetDate
    ? (metrics.find((m) => m.date === targetDate) ?? metrics[metrics.length - 1])
    : metrics[metrics.length - 1]

  const freshness    = latest.tsb
  const fitnessLevel = latest.ctl
  const loadRatio    = latest.ctl > 0 ? latest.atl / latest.ctl : 1

  // Score 0–100: freshness weight 40%, fitness 40%, load balance 20%
  const freshnessScore = Math.min(Math.max(freshness / 20, 0), 1) * 40
  const fitnessScore   = Math.min(fitnessLevel / 150, 1) * 40
  const loadScore      = Math.max(0, (1.2 - loadRatio) / 0.7) * 20
  const score          = Math.round(freshnessScore + fitnessScore + loadScore)

  const label: UltraReadyScore['label'] =
    score < 20 ? 'not_ready'
    : score < 40 ? 'building'
    : score < 60 ? 'approaching'
    : score < 80 ? 'ready'
    : 'peak'

  return { score, label, freshness, fitnessLevel, loadRatio: Math.round(loadRatio * 100) / 100 }
}
```

- [ ] **Step 7: Run all analytics tests**

```bash
cd web && npx jest __tests__/analytics/
```
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add web/lib/analytics/ web/__tests__/analytics/
git commit -m "feat(web): analytics engine — fatigue EWMA (k=7/k=42), load aggregation, ultra-ready score"
```

---

## Task 8: Jest configuration

**Files:**
- Create: `web/jest.config.js`
- Create: `web/jest.setup.ts`

- [ ] **Step 1: Create `web/jest.config.js`**

```js
const nextJest = require('next/jest').default

const createJestConfig = nextJest({ dir: './' })

const customConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
}

module.exports = createJestConfig(customConfig)
```

- [ ] **Step 2: Create `web/jest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Install and run all tests**

```bash
cd web && npm install
npx jest
```
Expected: All PASS (analytics + mapper tests)

- [ ] **Step 4: Commit**

```bash
git add web/jest.config.js web/jest.setup.ts
git commit -m "feat(web): Jest config with Next.js integration and @/ path aliases"
```

---

## Task 9: Bottom navigation + App shell

**Files:**
- Create: `web/components/navigation/BottomNav.tsx`
- Create: `web/components/navigation/AppShell.tsx`

- [ ] **Step 1: Create `web/components/navigation/BottomNav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutDashboard, Activity, Bot, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',           icon: Home,            label: 'Accueil'   },
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/activities', icon: Activity,        label: 'Activités' },
  { href: '/coach',      icon: Bot,             label: 'Coach'     },
  { href: '/settings',   icon: Settings,        label: 'Réglages'  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-trail-surface border-t border-trail-border pb-safe">
      <div className="flex items-stretch max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs transition-colors ${
                active ? 'text-trail-primary' : 'text-trail-muted hover:text-trail-text'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create `web/components/navigation/AppShell.tsx`**

```tsx
import { BottomNav } from './BottomNav'

type AppShellProps = {
  children: React.ReactNode
  title?: string
}

export function AppShell({ children, title }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-trail-bg">
      {title && (
        <header className="sticky top-0 z-40 bg-trail-bg/95 backdrop-blur border-b border-trail-border px-4 py-3">
          <h1 className="text-lg font-semibold text-trail-text">{title}</h1>
        </header>
      )}
      <main className="flex-1 pb-24 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/
git commit -m "feat(web): bottom navigation and app shell for mobile layout"
```

---

## Task 10: Home page

**Files:**
- Create: `web/app/page.tsx`

- [ ] **Step 1: Create `web/app/page.tsx`**

```tsx
import Link from 'next/link'
import { Mountain, Zap, BarChart3, Brain } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-trail-bg flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8">
        <div className="mb-6 w-16 h-16 rounded-2xl bg-trail-primary/20 border border-trail-primary/30 flex items-center justify-center">
          <Mountain className="text-trail-primary" size={32} />
        </div>
        <h1 className="text-3xl font-bold text-trail-text mb-3 tracking-tight">Trail Cockpit</h1>
        <p className="text-trail-muted text-base max-w-xs leading-relaxed">
          Pilotez votre entraînement trail &amp; endurance avec précision
        </p>
        <div className="mt-10 w-full max-w-xs space-y-3">
          <Link
            href="/dashboard"
            className="block w-full py-3.5 px-6 rounded-2xl bg-trail-primary text-white font-semibold text-center text-base active:scale-95 transition-transform"
          >
            Voir le Dashboard
          </Link>
          <Link
            href="/settings"
            className="block w-full py-3.5 px-6 rounded-2xl bg-trail-surface border border-trail-border text-trail-text font-medium text-center text-base"
          >
            Connecter Strava
          </Link>
        </div>
      </div>

      {/* Feature grid */}
      <div className="px-6 pb-16 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
        {[
          { icon: BarChart3, title: 'Charge',  desc: 'ATL / CTL / TSB en temps réel' },
          { icon: Zap,        title: 'CES',     desc: 'Score effort multi-sports'      },
          { icon: Brain,      title: 'Coach',   desc: 'Analyse IA de vos séances'      },
          { icon: Mountain,   title: 'Ultra',   desc: 'Préparation ultra trails'        },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-trail-surface border border-trail-border rounded-2xl p-4">
            <Icon className="text-trail-primary mb-2" size={20} />
            <p className="font-semibold text-trail-text text-sm">{title}</p>
            <p className="text-trail-muted text-xs mt-0.5 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat(web): home / landing page with hero and feature highlights"
```

---

## Task 11: Dashboard page (KPIs + load chart)

**Files:**
- Create: `web/components/ui/KpiCard.tsx`
- Create: `web/components/ui/LoadChart.tsx`
- Create: `web/app/dashboard/page.tsx`

- [ ] **Step 1: Create `web/components/ui/KpiCard.tsx`**

```tsx
type KpiCardProps = {
  label: string
  value: string | number
  unit?: string
  sub?: string
  accent?: boolean
}

export function KpiCard({ label, value, unit, sub, accent }: KpiCardProps) {
  return (
    <div className={`rounded-2xl p-4 border ${
      accent
        ? 'bg-trail-primary/10 border-trail-primary/30'
        : 'bg-trail-card border-trail-border'
    }`}>
      <p className="text-trail-muted text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-trail-primary' : 'text-trail-text'}`}>
        {value}
        {unit && <span className="text-sm font-normal ml-1 text-trail-muted">{unit}</span>}
      </p>
      {sub && <p className="text-trail-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `web/components/ui/LoadChart.tsx`**

```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type LoadChartProps = {
  data: { date: string; atl: number; ctl: number }[]
  height?: number
}

export function LoadChart({ data, height = 180 }: LoadChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAtl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gradCtl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e8eaf0' }} />
        <Area type="monotone" dataKey="atl" stroke="#f97316" strokeWidth={2} fill="url(#gradAtl)" name="Fatigue" />
        <Area type="monotone" dataKey="ctl" stroke="#22d3ee" strokeWidth={2} fill="url(#gradCtl)" name="Fitness" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Create `web/app/dashboard/page.tsx`**

```tsx
import { AppShell } from '@/components/navigation/AppShell'
import { KpiCard }  from '@/components/ui/KpiCard'
import { LoadChart } from '@/components/ui/LoadChart'
import { buildDailyMetrics } from '@/lib/analytics/fatigue'

// Deterministic mock data (server component — no Math.random)
const MOCK_LOADS = [
  { date: '2026-04-03', ces: 45 }, { date: '2026-04-04', ces: 0  },
  { date: '2026-04-05', ces: 72 }, { date: '2026-04-06', ces: 55 },
  { date: '2026-04-07', ces: 88 }, { date: '2026-04-08', ces: 0  },
  { date: '2026-04-09', ces: 30 }, { date: '2026-04-10', ces: 60 },
  { date: '2026-04-11', ces: 48 }, { date: '2026-04-12', ces: 95 },
  { date: '2026-04-13', ces: 0  }, { date: '2026-04-14', ces: 40 },
  { date: '2026-04-15', ces: 78 }, { date: '2026-04-16', ces: 62 },
  { date: '2026-04-17', ces: 0  }, { date: '2026-04-18', ces: 85 },
  { date: '2026-04-19', ces: 50 }, { date: '2026-04-20', ces: 110},
  { date: '2026-04-21', ces: 0  }, { date: '2026-04-22', ces: 35 },
  { date: '2026-04-23', ces: 68 }, { date: '2026-04-24', ces: 55 },
  { date: '2026-04-25', ces: 92 }, { date: '2026-04-26', ces: 0  },
  { date: '2026-04-27', ces: 45 }, { date: '2026-04-28', ces: 70 },
  { date: '2026-04-29', ces: 58 }, { date: '2026-04-30', ces: 80 },
  { date: '2026-05-01', ces: 0  }, { date: '2026-05-02', ces: 65 },
]

export default function DashboardPage() {
  const metrics = buildDailyMetrics(MOCK_LOADS)
  const latest  = metrics[metrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0, dailyLoad: 0 }
  const chartData = metrics.slice(-14).map((m) => ({
    date: m.date.slice(5),
    atl:  m.atl,
    ctl:  m.ctl,
  }))

  return (
    <AppShell title="Dashboard">
      <div className="px-4 py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Fatigue (ATL)" value={Math.round(latest.atl)} sub="7j EWMA" />
          <KpiCard label="Fitness (CTL)"  value={Math.round(latest.ctl)} sub="42j EWMA" accent />
          <KpiCard label="Fraîcheur (TSB)" value={Math.round(latest.tsb)} sub={latest.tsb >= 0 ? 'Reposé ✓' : 'Fatigué'} />
          <KpiCard label="Charge du jour"  value={Math.round(latest.dailyLoad)} unit="CES" />
        </div>

        {/* Load chart */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-3">Fatigue vs Fitness — 14 jours</h2>
          <LoadChart data={chartData} />
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-trail-muted">
              <span className="w-3 h-0.5 bg-[#f97316] rounded-full inline-block" />Fatigue
            </span>
            <span className="flex items-center gap-1.5 text-xs text-trail-muted">
              <span className="w-3 h-0.5 bg-[#22d3ee] rounded-full inline-block" />Fitness
            </span>
          </div>
        </div>

        {/* Week placeholder */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-2">Cette semaine</h2>
          <p className="text-trail-muted text-xs mb-3">Connecte Strava pour voir tes activités</p>
          <div className="grid grid-cols-7 gap-1">
            {['L','M','M','J','V','S','D'].map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-full h-10 rounded-lg bg-trail-border/40" />
                <span className="text-xs text-trail-muted">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add web/components/ui/ web/app/dashboard/
git commit -m "feat(web): dashboard page — KPI cards, fatigue/fitness chart, week overview"
```

---

## Task 12: Activities, Coach, Settings pages

**Files:**
- Create: `web/app/activities/page.tsx`
- Create: `web/app/coach/page.tsx`
- Create: `web/app/settings/page.tsx`

- [ ] **Step 1: Create `web/app/activities/page.tsx`**

```tsx
import { AppShell } from '@/components/navigation/AppShell'
import { Activity, ChevronRight } from 'lucide-react'

const SPORT_LABEL: Record<string, string> = {
  Run: 'Course', TrailRun: 'Trail', GravelRide: 'Gravel',
  Ride: 'Vélo', VirtualRide: 'Home trainer', Swim: 'Natation',
}

const MOCK_ACTIVITIES = [
  { id: '1', name: 'Trail du Matin',  type: 'TrailRun',   date: '2026-05-02', distanceKm: 12.4, dPlus: 450, ces: 87  },
  { id: '2', name: 'Footing EF',      type: 'Run',        date: '2026-05-01', distanceKm: 9.2,  dPlus: 80,  ces: 48  },
  { id: '3', name: 'Sortie Gravel',   type: 'GravelRide', date: '2026-04-30', distanceKm: 65.0, dPlus: 800, ces: 112 },
  { id: '4', name: 'Natation',        type: 'Swim',       date: '2026-04-28', distanceKm: 2.0,  dPlus: 0,   ces: 55  },
]

export default function ActivitiesPage() {
  return (
    <AppShell title="Activités">
      <div className="px-4 py-4 space-y-2">
        {MOCK_ACTIVITIES.map((a) => (
          <div key={a.id} className="bg-trail-card border border-trail-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-trail-primary/15 flex items-center justify-center flex-shrink-0">
              <Activity size={18} className="text-trail-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-trail-text truncate">{a.name}</p>
              <p className="text-xs text-trail-muted mt-0.5">
                {SPORT_LABEL[a.type] ?? a.type} · {a.distanceKm} km · D+ {a.dPlus} m
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs font-bold text-trail-primary">{a.ces} CES</span>
              <span className="text-xs text-trail-muted">{a.date.slice(5)}</span>
            </div>
            <ChevronRight size={16} className="text-trail-muted flex-shrink-0" />
          </div>
        ))}
        <p className="text-center text-trail-muted text-xs pt-4">
          Connecte Strava dans Réglages pour importer tes activités
        </p>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Create `web/app/coach/page.tsx`**

```tsx
import { AppShell } from '@/components/navigation/AppShell'
import { Brain, Send } from 'lucide-react'

const SUGGESTIONS = [
  'Quelle est ma forme du moment ?',
  'Suis-je prêt pour un ultra ?',
  'Combien de km cette semaine ?',
]

export default function CoachPage() {
  return (
    <AppShell title="Coach IA">
      <div className="flex flex-col px-4 py-4 min-h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 mb-6 p-4 bg-trail-card border border-trail-border rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-trail-accent/15 flex items-center justify-center flex-shrink-0">
            <Brain size={20} className="text-trail-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-trail-text">Coach Trail</p>
            <p className="text-xs text-trail-muted">Analyse basée sur tes données réelles</p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              className="w-full text-left px-4 py-3 bg-trail-surface border border-trail-border rounded-xl text-sm text-trail-text hover:border-trail-primary/50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="mt-auto flex gap-2 pt-4">
          <div className="flex-1 bg-trail-surface border border-trail-border rounded-xl px-4 py-3 text-sm text-trail-muted">
            Pose ta question au coach...
          </div>
          <button className="w-11 h-11 rounded-xl bg-trail-primary flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
            <Send size={18} className="text-white" />
          </button>
        </div>
        <p className="text-center text-xs text-trail-muted mt-3">
          Coach IA disponible après connexion Strava
        </p>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 3: Create `web/app/settings/page.tsx`**

```tsx
import { AppShell } from '@/components/navigation/AppShell'
import { ExternalLink, ChevronRight, Circle } from 'lucide-react'

export default function SettingsPage() {
  return (
    <AppShell title="Réglages">
      <div className="px-4 py-4 space-y-4">
        {/* Connexions */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Connexions</p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-xl bg-[#FC4C02]/15 flex items-center justify-center flex-shrink-0">
                <ExternalLink size={16} className="text-[#FC4C02]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-trail-text">Strava</p>
                <p className="text-xs text-trail-muted">Non connecté</p>
              </div>
              <a
                href="/api/strava/connect"
                className="px-3 py-1.5 rounded-lg bg-[#FC4C02] text-white text-xs font-semibold"
              >
                Connecter
              </a>
            </div>
            {['Garmin', 'Polar', 'Suunto', 'Coros'].map((p) => (
              <div key={p} className="flex items-center gap-3 p-4 opacity-50">
                <Circle size={18} className="text-trail-muted" />
                <p className="text-sm text-trail-text flex-1">{p}</p>
                <span className="text-xs text-trail-muted">Bientôt</span>
              </div>
            ))}
          </div>
        </section>

        {/* Profil athlète */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Profil athlète</p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            {[
              ['FC max',         '185 bpm'],
              ['FC seuil',       '165 bpm'],
              ['Allure seuil',   '5:00/km'],
              ['FTP vélo',       '220 W'  ],
              ['Objectif annuel','3 000 km'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between p-4">
                <p className="text-sm text-trail-text">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-trail-muted">{value}</span>
                  <ChevronRight size={14} className="text-trail-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add web/app/activities/ web/app/coach/ web/app/settings/
git commit -m "feat(web): activities, coach, settings pages"
```

---

## Task 13: Admin page (mocked stats)

**Files:**
- Create: `web/app/admin/page.tsx`

- [ ] **Step 1: Create `web/app/admin/page.tsx`**

```tsx
import { AppShell } from '@/components/navigation/AppShell'
import { Users, Plug, Activity, Webhook, RefreshCw, AlertTriangle, Brain } from 'lucide-react'

const STATS = [
  { icon: Users,         label: 'Utilisateurs',       value: '1',    color: 'text-trail-accent'   },
  { icon: Plug,          label: 'Connexions actives',  value: '1',    color: 'text-trail-success'  },
  { icon: Activity,      label: 'Activités importées', value: '234',  color: 'text-trail-primary'  },
  { icon: Webhook,       label: 'Webhooks reçus',      value: '47',   color: 'text-trail-warning'  },
  { icon: RefreshCw,     label: 'Jobs en attente',     value: '3',    color: 'text-trail-accent'   },
  { icon: AlertTriangle, label: 'Erreurs (24h)',        value: '0',    color: 'text-trail-danger'   },
  { icon: Brain,         label: 'Tokens IA (mois)',    value: '~12k', color: 'text-trail-muted'    },
]

const RECENT_WEBHOOKS = [
  { provider: 'strava', event: 'activity.create', at: '2026-05-02 09:14' },
  { provider: 'strava', event: 'activity.update', at: '2026-05-01 18:32' },
  { provider: 'strava', event: 'activity.create', at: '2026-05-01 07:55' },
]

export default function AdminPage() {
  return (
    <AppShell title="Admin">
      <div className="px-4 py-4 space-y-4">
        <div className="bg-trail-warning/10 border border-trail-warning/30 rounded-2xl px-4 py-3">
          <p className="text-xs text-trail-warning font-medium">⚠ Zone admin — accès restreint</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {STATS.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-trail-card border border-trail-border rounded-2xl p-4">
              <Icon size={18} className={`${color} mb-2`} />
              <p className="text-2xl font-bold text-trail-text">{value}</p>
              <p className="text-xs text-trail-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-3">Derniers webhooks reçus</h2>
          {RECENT_WEBHOOKS.map((w, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-trail-border last:border-0">
              <div>
                <p className="text-xs font-medium text-trail-text">{w.event}</p>
                <p className="text-xs text-trail-muted">{w.provider}</p>
              </div>
              <span className="text-xs text-trail-muted">{w.at}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/admin/
git commit -m "feat(web): admin page with mocked stats, webhook log, sync jobs"
```

---

## Task 14: Strava OAuth routes

**Files:**
- Create: `web/lib/providers/strava/auth.ts`
- Create: `web/app/api/strava/connect/route.ts`
- Create: `web/app/api/strava/callback/route.ts`

- [ ] **Step 1: Create `web/lib/providers/strava/auth.ts`**

```ts
const STRAVA_SCOPES = 'activity:read_all,profile:read_all'

export function buildStravaAuthUrl(redirectUri: string, state: string): string {
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id',       process.env.STRAVA_CLIENT_ID!)
  url.searchParams.set('response_type',   'code')
  url.searchParams.set('redirect_uri',    redirectUri)
  url.searchParams.set('approval_prompt', 'force')
  url.searchParams.set('scope',           STRAVA_SCOPES)
  url.searchParams.set('state',           state)
  return url.toString()
}

export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Strava token exchange: ${res.status} ${await res.text()}`)
  return res.json()
}

export type StravaTokenResponse = {
  access_token:  string
  refresh_token: string
  expires_at:    number
  athlete: {
    id:        number
    firstname: string
    lastname:  string
    profile:   string
  }
}
```

- [ ] **Step 2: Create `web/app/api/strava/connect/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { buildStravaAuthUrl } from '@/lib/providers/strava/auth'
import { createClient } from '@/lib/database/supabase-server'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/settings', process.env.APP_URL!))
  }

  const state       = randomBytes(16).toString('hex')
  const redirectUri = process.env.STRAVA_REDIRECT_URI!
  const authUrl     = buildStravaAuthUrl(redirectUri, state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('strava_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,
  })
  return response
}
```

- [ ] **Step 3: Create `web/app/api/strava/callback/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { exchangeStravaCode } from '@/lib/providers/strava/auth'
import { createClient } from '@/lib/database/supabase-server'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${APP_URL}/settings?strava=unauthenticated`)
  }

  try {
    const tokens = await exchangeStravaCode(code)

    await supabase.from('provider_connections').upsert({
      user_id:         user.id,
      provider:        'strava',
      provider_user_id:String(tokens.athlete.id),
      access_token:    tokens.access_token,
      refresh_token:   tokens.refresh_token,
      token_expires_at:new Date(tokens.expires_at * 1000).toISOString(),
      scope:           'activity:read_all,profile:read_all',
      athlete_data:    tokens.athlete,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

    return NextResponse.redirect(`${APP_URL}/settings?strava=connected`)
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(`${APP_URL}/settings?strava=error`)
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/providers/strava/auth.ts web/app/api/strava/
git commit -m "feat(web): Strava OAuth connect and callback route handlers"
```

---

## Task 15: Strava webhook

**Files:**
- Create: `web/lib/providers/strava/webhook.ts`
- Create: `web/app/api/webhooks/strava/route.ts`

- [ ] **Step 1: Create `web/lib/providers/strava/webhook.ts`**

```ts
export type StravaWebhookEvent = {
  object_type:     'activity' | 'athlete'
  object_id:       number
  aspect_type:     'create' | 'update' | 'delete'
  owner_id:        number
  subscription_id: number
  event_time:      number
  updates?:        Record<string, unknown>
}
```

- [ ] **Step 2: Create `web/app/api/webhooks/strava/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database/supabase-server'
import type { StravaWebhookEvent } from '@/lib/providers/strava/webhook'

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? 'trail_cockpit_webhook_secret'

// GET: Strava hub challenge validation
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode        = searchParams.get('hub.mode')
  const challenge   = searchParams.get('hub.challenge')
  const verifyToken = searchParams.get('hub.verify_token')

  if (mode === 'subscribe' && verifyToken === VERIFY_TOKEN && challenge) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

// POST: receive Strava push event
export async function POST(request: NextRequest) {
  // Respond immediately — Strava requires < 2s response
  const supabase = createServiceClient()

  let event: StravaWebhookEvent
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Fire-and-forget: store raw event + enqueue sync job
  Promise.resolve().then(async () => {
    try {
      const { data: webhookRow } = await supabase
        .from('webhook_events')
        .insert({
          provider:    'strava',
          event_type:  event.aspect_type,
          object_type: event.object_type,
          object_id:   String(event.object_id),
          owner_id:    String(event.owner_id),
          raw_payload: event,
        })
        .select('id')
        .single()

      if (event.object_type === 'activity') {
        await supabase.from('sync_jobs').insert({
          provider:  'strava',
          job_type:  `activity_${event.aspect_type}`,
          status:    'pending',
          payload: {
            activityId:     event.object_id,
            athleteId:      event.owner_id,
            webhookEventId: webhookRow?.id,
          },
        })
      }
    } catch (e) {
      console.error('Webhook processing error:', e)
    }
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/providers/strava/webhook.ts web/app/api/webhooks/
git commit -m "feat(web): Strava webhook — hub challenge validation, event store, sync job enqueue"
```

---

## Task 16: PWA manifest

**Files:**
- Create: `web/public/manifest.json`
- Create: `web/public/icons/.gitkeep`

- [ ] **Step 1: Create `web/public/manifest.json`**

```json
{
  "name": "Trail Cockpit",
  "short_name": "Trail",
  "description": "Dashboard trail running & endurance",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f1117",
  "theme_color": "#f97316",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "categories": ["sports", "health", "fitness"],
  "lang": "fr"
}
```

- [ ] **Step 2: Create `web/public/icons/.gitkeep`**

```bash
mkdir -p web/public/icons && touch web/public/icons/.gitkeep
```

Note: place real 192×192 and 512×512 PNG icons in `web/public/icons/` before submitting to PWA stores. Any image with the mountain icon in orange `#f97316` on dark `#0f1117` background works.

- [ ] **Step 3: Commit**

```bash
git add web/public/
git commit -m "feat(web): PWA manifest — standalone display, trail orange theme, icon placeholders"
```

---

## Task 17: web/README.md

**Files:**
- Create: `web/README.md`

- [ ] **Step 1: Create `web/README.md`**

```markdown
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

Redémarrer `npm run dev` après chaque changement d'`APP_URL`.

## Migrations Supabase

```bash
# Avec Supabase CLI
supabase db push

# Ou copier/coller dans le SQL Editor de ton projet Supabase
cat supabase/migrations/001_initial_schema.sql
cat supabase/migrations/002_rls_policies.sql
```

## Déploiement Vercel

1. Connecter le repo sur vercel.com
2. **Root Directory** → `web`
3. Ajouter toutes les variables d'env
4. Deploy

Le `STRAVA_REDIRECT_URI` doit pointer vers l'URL Vercel de production.

## Préparer Capacitor (futur)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "Trail Cockpit" "com.franck.trailcockpit"
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
```

- [ ] **Step 2: Commit**

```bash
git add web/README.md
git commit -m "docs(web): README — install, dev, ngrok, Vercel deploy, Capacitor prep"
```

---

## Task 18: Final verification

- [ ] **Step 1: Install dependencies**

```bash
cd web && npm install
```
Expected: No errors. `node_modules/` created.

- [ ] **Step 2: Run tests**

```bash
cd web && npm test
```
Expected: All PASS — analytics + mapper tests.

- [ ] **Step 3: Type check**

```bash
cd web && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Lint**

```bash
cd web && npm run lint
```
Expected: No errors.

- [ ] **Step 5: Build**

```bash
cd web && npm run build
```
Expected: Build completes. `.next/` created.

- [ ] **Step 6: Start dev server**

```bash
cd web && npm run dev
```
Expected: `ready - started server on 0.0.0.0:3000`

- [ ] **Step 7: Verify pages load**

Open in browser:
- http://localhost:3000 → Home page with hero
- http://localhost:3000/dashboard → KPI cards + load chart
- http://localhost:3000/activities → Activity list
- http://localhost:3000/coach → Coach IA skeleton
- http://localhost:3000/settings → Settings + Strava connect
- http://localhost:3000/admin → Admin mocked stats

- [ ] **Step 8: Test on mobile with ngrok**

```bash
ngrok http 3000
```

Open the ngrok URL on your phone. The bottom nav and layout should be mobile-native.

---

## Self-Review

### Spec coverage

| Mission | Task | Status |
|---|---|---|
| M1 Audit | Pre-plan analysis | ✅ |
| M2 Créer la web app dans `web/` | Task 1 | ✅ |
| M3 Config Next.js + `npm run dev` | Tasks 1–2 | ✅ |
| M4 Interface mobile-first (5 pages + bottom nav) | Tasks 9–13 | ✅ |
| M5 Supabase (client + server + .env.example) | Task 3 | ✅ |
| M6 DB migrations (10 tables) | Task 4 | ✅ |
| M7 Architecture providers (NormalizedActivity + Strava mapper + skeletons) | Task 5 | ✅ |
| M8 Strava OAuth + webhook | Tasks 14–15 | ✅ |
| M9 Analytics (CES, fatigue, load, ultra-ready) | Tasks 6–7 | ✅ |
| M10 Admin page | Task 13 | ✅ |
| M11 PWA manifest | Task 16 | ✅ |
| M12 Documentation | Task 17 | ✅ |
| M13 Android untouched | Enforced — no writes to `app/`, `backend/`, `gradle/` | ✅ |
| M14 Test final | Task 18 | ✅ |

### Placeholder scan

No TBDs or "implement later". All functions have complete code.

### Type consistency

- `NormalizedActivity` — defined in `lib/providers/strava/mapper.ts`, imported by garmin/polar/suunto skeletons ✅
- `ActivityInput` — defined in `lib/analytics/types.ts`, re-exported from `effort-score.ts`, used in `load.ts` ✅
- `DailyLoad` — defined and exported from `fatigue.ts`, used in `load.ts` ✅
- `DailyMetrics` — defined and exported from `fatigue.ts`, used in `ultra-ready.ts` and `dashboard/page.tsx` ✅
- `buildDailyMetrics` — exported from `fatigue.ts`, imported in `dashboard/page.tsx` ✅
- `AppShell` — exported from `components/navigation/AppShell.tsx`, imported in all 5 page files ✅
- `StravaTokenResponse` — defined and exported from `lib/providers/strava/auth.ts`, used in `callback/route.ts` ✅
- `createServiceClient` — exported from `lib/database/supabase-server.ts`, used in `webhooks/strava/route.ts` ✅
- `jest.config.js` uses `setupFilesAfterEnv` (correct Jest key) ✅

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-web-migration.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
