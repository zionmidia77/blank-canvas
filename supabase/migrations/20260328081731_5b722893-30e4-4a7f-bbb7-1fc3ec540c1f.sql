
CREATE TABLE public.financing_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  moto_value NUMERIC NOT NULL,
  down_payment NUMERIC NOT NULL DEFAULT 0,
  financed_amount NUMERIC NOT NULL,
  months INTEGER NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL DEFAULT 0.019,
  total_interest NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'simulator',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financing_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert simulations" ON public.financing_simulations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated users can manage simulations" ON public.financing_simulations FOR ALL TO authenticated USING (true) WITH CHECK (true);
