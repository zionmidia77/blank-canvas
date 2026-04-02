
CREATE TABLE public.bot_posting_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.stock_vehicles(id) ON DELETE CASCADE NOT NULL,
  local_bot_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamp with time zone DEFAULT now(),
  posted_at timestamp with time zone,
  error_msg text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_posting_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage bot_posting_queue"
  ON public.bot_posting_queue FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Bot can read queue"
  ON public.bot_posting_queue FOR SELECT TO anon
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_posting_queue;
