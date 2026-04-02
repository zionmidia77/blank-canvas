
-- Add local_bot_id to stock_vehicles
ALTER TABLE public.stock_vehicles ADD COLUMN IF NOT EXISTS local_bot_id text;

-- Add vehicle_id to clients (links lead to the vehicle that generated interest)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.stock_vehicles(id);

-- Populate local_bot_id based on brand + model + year
UPDATE public.stock_vehicles SET local_bot_id = 'v1' WHERE brand ILIKE '%Honda%' AND model ILIKE '%Titan%' AND model ILIKE '%150%' AND year = 2012;
UPDATE public.stock_vehicles SET local_bot_id = 'v2' WHERE brand ILIKE '%Chevrolet%' AND model ILIKE '%Onix%' AND year = 2024;
UPDATE public.stock_vehicles SET local_bot_id = 'v3' WHERE brand ILIKE '%Audi%' AND model ILIKE '%A4%' AND year = 2013;
UPDATE public.stock_vehicles SET local_bot_id = 'v4' WHERE brand ILIKE '%Honda%' AND model ILIKE '%Biz%' AND year = 2013;
UPDATE public.stock_vehicles SET local_bot_id = 'v5' WHERE brand ILIKE '%Chevrolet%' AND model ILIKE '%Celta%' AND year = 2012;
UPDATE public.stock_vehicles SET local_bot_id = 'v6' WHERE brand ILIKE '%Honda%' AND model ILIKE '%Titan%' AND model ILIKE '%150%' AND year = 2009;
UPDATE public.stock_vehicles SET local_bot_id = 'v7' WHERE brand ILIKE '%Honda%' AND model ILIKE '%Titan%' AND model ILIKE '%150%' AND year = 2007;
UPDATE public.stock_vehicles SET local_bot_id = 'v8' WHERE brand ILIKE '%BMW%' AND model ILIKE '%S1000%' AND year = 2016;
UPDATE public.stock_vehicles SET local_bot_id = 'v9' WHERE brand ILIKE '%Volkswagen%' AND model ILIKE '%Saveiro%' AND year = 2019;
UPDATE public.stock_vehicles SET local_bot_id = 'v10' WHERE brand ILIKE '%Fiat%' AND model ILIKE '%Strada%' AND year = 2011;
UPDATE public.stock_vehicles SET local_bot_id = 'v11' WHERE brand ILIKE '%Fiat%' AND model ILIKE '%Uno%' AND year = 2017;
