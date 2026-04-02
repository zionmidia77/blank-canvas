ALTER TABLE public.stock_vehicles
  ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS purchase_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS fipe_value numeric,
  ADD COLUMN IF NOT EXISTS selling_price numeric,
  ADD COLUMN IF NOT EXISTS plate text,
  ADD COLUMN IF NOT EXISTS chassis text,
  ADD COLUMN IF NOT EXISTS renavam text,
  ADD COLUMN IF NOT EXISTS fuel text DEFAULT 'Flex',
  ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS documents_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_costs numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.vehicle_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.stock_vehicles(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vehicle_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vehicle_costs"
  ON public.vehicle_costs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_vehicle_total_costs()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE public.stock_vehicles
  SET total_costs = COALESCE((
    SELECT SUM(amount) FROM public.vehicle_costs WHERE vehicle_id = COALESCE(NEW.vehicle_id, OLD.vehicle_id)
  ), 0)
  WHERE id = COALESCE(NEW.vehicle_id, OLD.vehicle_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_vehicle_costs
  AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_total_costs();

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view vehicle photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Authenticated can upload vehicle photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "Authenticated can delete vehicle photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-photos');