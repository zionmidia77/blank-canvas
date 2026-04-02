
-- 1. Update pipeline_stage enum with better stages for motorcycle sales
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'attending';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'thinking';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'waiting_response';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'scheduled';
