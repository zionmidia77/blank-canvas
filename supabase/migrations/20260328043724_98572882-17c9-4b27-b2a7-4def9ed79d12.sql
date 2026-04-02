
-- Add follow-up scheduling fields to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_time time;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 3;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority integer DEFAULT 5;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Add last_contact_at to clients for tracking responsiveness
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_contact_at timestamp with time zone;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS response_time_hours integer;
