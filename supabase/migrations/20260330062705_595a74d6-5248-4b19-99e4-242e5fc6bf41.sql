-- SMS logs table
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  template_key text,
  trigger_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  smsdev_id text,
  error_message text,
  sent_at timestamp with time zone DEFAULT now(),
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sms_logs"
  ON public.sms_logs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- SMS automation rules table
CREATE TABLE public.sms_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL,
  days_inactive integer NOT NULL DEFAULT 1,
  message_template text NOT NULL,
  target_segment text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  max_sends_per_day integer NOT NULL DEFAULT 50,
  sends_today integer NOT NULL DEFAULT 0,
  last_reset_at date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sms_automations"
  ON public.sms_automations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_sms_automations_updated_at
  BEFORE UPDATE ON public.sms_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();