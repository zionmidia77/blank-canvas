
-- Add new pipeline stages
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'financing_analysis';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'reactivation';

-- Create timeline event type enum
CREATE TYPE public.timeline_event_type AS ENUM (
  'message_sent', 'message_received', 'whatsapp_paste', 'status_change',
  'proposal_sent', 'document_uploaded', 'ai_analysis', 'inactivity_detected',
  'note', 'call', 'visit'
);

-- Create lead_memory table (persistent AI memory per lead)
CREATE TABLE public.lead_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  summary TEXT,
  objections TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  behavior_patterns TEXT[] DEFAULT '{}',
  decisions TEXT[] DEFAULT '{}',
  ai_tags TEXT[] DEFAULT '{}',
  recommended_action TEXT,
  recommended_message TEXT,
  lead_temperature_ai TEXT,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Create lead_timeline_events table
CREATE TABLE public.lead_timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type public.timeline_event_type NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_timeline_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can manage lead_memory"
  ON public.lead_memory FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage lead_timeline_events"
  ON public.lead_timeline_events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_lead_memory_client ON public.lead_memory(client_id);
CREATE INDEX idx_timeline_client ON public.lead_timeline_events(client_id);
CREATE INDEX idx_timeline_created ON public.lead_timeline_events(client_id, created_at DESC);

-- Enable realtime for timeline
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_timeline_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_memory;
