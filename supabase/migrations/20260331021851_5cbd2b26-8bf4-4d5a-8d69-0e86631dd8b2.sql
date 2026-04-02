
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  tokens_used integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_usage_logs"
ON public.ai_usage_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role and anon can insert ai_usage_logs"
ON public.ai_usage_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at DESC);
CREATE INDEX idx_ai_usage_logs_function_name ON public.ai_usage_logs (function_name);
