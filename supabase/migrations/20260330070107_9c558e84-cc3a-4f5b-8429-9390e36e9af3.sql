
-- Atualizar anos e preços FIPE das motos do catálogo (removendo anos 2024/2023)

-- MT-03: 2023 → 2018, FIPE R$ 20.394
UPDATE public.stock_vehicles SET year = 2018, price = 20394, selling_price = 20394, fipe_value = 20394 WHERE id = '0b6648b6-6c91-447a-9f01-1935650f381d';

-- CG 160 Titan: 2024 → 2018, FIPE R$ 14.088
UPDATE public.stock_vehicles SET year = 2018, price = 14088, selling_price = 14088, fipe_value = 14088 WHERE id = 'c8237fa7-e84c-4f5c-9366-d0bd92f2e89f';

-- CG 160 Fan: 2024 → 2017, FIPE R$ 12.143
UPDATE public.stock_vehicles SET year = 2017, price = 12143, selling_price = 12143, fipe_value = 12143 WHERE id = '66ed600c-bd45-4cbe-af0b-0c0fdc15a9a6';

-- Bros 160: 2024 → 2016, FIPE R$ 16.500
UPDATE public.stock_vehicles SET year = 2016, model = 'NXR 160 Bros ESDD', price = 16500, selling_price = 16500, fipe_value = 16500 WHERE id = '0ddfd906-9cf6-4579-93d9-b3b77ec9ba46';

-- PCX 150: 2024 → 2016, FIPE R$ 14.500
UPDATE public.stock_vehicles SET year = 2016, model = 'PCX 150', price = 14500, selling_price = 14500, fipe_value = 14500 WHERE id = '82a528d0-9ef8-453b-8cde-6c8e46d29cbf';

-- XRE 300: 2024 → 2016, FIPE R$ 21.000
UPDATE public.stock_vehicles SET year = 2016, price = 21000, selling_price = 21000, fipe_value = 21000 WHERE id = 'f4820e8d-3169-4208-8e5e-66ddad7bd08f';

-- CB 300F Twister: 2024 → 2017, FIPE R$ 18.000
UPDATE public.stock_vehicles SET year = 2017, price = 18000, selling_price = 18000, fipe_value = 18000 WHERE id = 'cd006790-7747-4892-977c-3c9f6ae8ca58';

-- Biz 125: 2024 → 2016, FIPE R$ 11.500
UPDATE public.stock_vehicles SET year = 2016, price = 11500, selling_price = 11500, fipe_value = 11500 WHERE id = '41bef2cd-94ba-4021-9ac1-2e664ed6d349';

-- CG 160 Start: 2022 → 2019, FIPE R$ 13.000
UPDATE public.stock_vehicles SET year = 2019, price = 13000, selling_price = 13000, fipe_value = 13000 WHERE id = '66560f30-9e5b-44f1-a8ed-106bb5b650b3';

-- Pop 110i: 2024 → 2018, FIPE R$ 9.500
UPDATE public.stock_vehicles SET year = 2018, price = 9500, selling_price = 9500, fipe_value = 9500 WHERE id = '50b31014-c456-4cd6-9927-89a5cec14c28';

-- Factor 150: 2023 → 2017, FIPE R$ 10.500
UPDATE public.stock_vehicles SET year = 2017, price = 10500, selling_price = 10500, fipe_value = 10500 WHERE id = '5cfc53c9-1332-4794-9ea5-03e197dea52e';

-- Fazer 250: 2023 → 2015, FIPE R$ 15.000
UPDATE public.stock_vehicles SET year = 2015, price = 15000, selling_price = 15000, fipe_value = 15000 WHERE id = '61ed4b69-52ea-4ecf-8b61-3e46878de955';

-- Remover veículo de teste
DELETE FROM public.stock_vehicles WHERE id = 'e747f971-4234-4a0f-80f9-c5d9156c0cc4';
