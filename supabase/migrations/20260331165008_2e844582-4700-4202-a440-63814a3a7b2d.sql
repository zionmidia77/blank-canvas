
-- Bot configurations table
CREATE TABLE public.bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name text NOT NULL,
  seller_email text,
  facebook_account text,
  platform text NOT NULL DEFAULT 'facebook',
  is_active boolean NOT NULL DEFAULT false,
  max_per_cycle integer NOT NULL DEFAULT 5,
  delay_seconds integer NOT NULL DEFAULT 30,
  dry_mode boolean NOT NULL DEFAULT false,
  leads_captured_today integer NOT NULL DEFAULT 0,
  last_reset_at date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bot logs table
CREATE TABLE public.bot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_config_id uuid REFERENCES public.bot_configs(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL DEFAULT 'message',
  platform text NOT NULL DEFAULT 'facebook',
  contact_name text,
  message_in text,
  message_out text,
  lead_created boolean NOT NULL DEFAULT false,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can manage bot_configs" ON public.bot_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage bot_logs" ON public.bot_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime for logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_logs;
