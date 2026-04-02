
ALTER TABLE public.bot_configs
  ADD COLUMN IF NOT EXISTS bot_type text DEFAULT 'messaging',
  ADD COLUMN IF NOT EXISTS schedule_time time,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
