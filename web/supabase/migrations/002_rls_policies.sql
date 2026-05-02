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
