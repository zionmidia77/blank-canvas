
CREATE TABLE public.stock_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  km INTEGER DEFAULT 0,
  color TEXT,
  price NUMERIC NOT NULL,
  condition TEXT NOT NULL DEFAULT 'used',
  status TEXT NOT NULL DEFAULT 'available',
  image_url TEXT,
  description TEXT,
  features TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stock" ON public.stock_vehicles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can manage stock" ON public.stock_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
