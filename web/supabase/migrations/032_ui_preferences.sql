-- Add ui_preferences JSONB column to profiles for cross-device sync
-- Stores block layout (order, hidden, widths), goals targets/settings, sport filters
alter table profiles
  add column if not exists ui_preferences jsonb default '{}'::jsonb;
