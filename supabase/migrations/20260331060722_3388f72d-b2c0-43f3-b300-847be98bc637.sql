
-- Add new pipeline_stage values
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'first_contact';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'qualification';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'proposal';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'negotiation';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'closing';
