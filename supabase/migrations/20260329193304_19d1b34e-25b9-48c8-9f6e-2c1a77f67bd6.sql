ALTER TABLE public.stock_vehicles
  ADD COLUMN IF NOT EXISTS fipe_brand_code text,
  ADD COLUMN IF NOT EXISTS fipe_model_code text,
  ADD COLUMN IF NOT EXISTS fipe_year_code text,
  ADD COLUMN IF NOT EXISTS fipe_vehicle_type text DEFAULT 'carros',
  ADD COLUMN IF NOT EXISTS fipe_updated_at timestamp with time zone;