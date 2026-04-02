-- NPS responses table
CREATE TABLE IF NOT EXISTS public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage nps_responses"
  ON public.nps_responses FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Exclusive offers table
CREATE TABLE IF NOT EXISTS public.exclusive_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  discount_percent integer,
  valid_until date,
  target_segment text NOT NULL DEFAULT 'closed_won',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusive_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage exclusive_offers"
  ON public.exclusive_offers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Offer claims tracking
CREATE TABLE IF NOT EXISTS public.offer_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.exclusive_offers(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(offer_id, client_id)
);

ALTER TABLE public.offer_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage offer_claims"
  ON public.offer_claims FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Revision/maintenance reminders function
CREATE OR REPLACE FUNCTION public.auto_revision_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  vehicle_rec RECORD;
  months_owned INTEGER;
BEGIN
  FOR vehicle_rec IN
    SELECT v.id, v.client_id, v.brand, v.model, v.created_at,
           c.name
    FROM public.vehicles v
    JOIN public.clients c ON c.id = v.client_id
    WHERE v.status = 'current' AND c.status != 'lost'
  LOOP
    months_owned := EXTRACT(MONTH FROM age(now(), vehicle_rec.created_at))
                  + EXTRACT(YEAR FROM age(now(), vehicle_rec.created_at))::INTEGER * 12;

    -- 6-month revision reminder
    IF months_owned IN (6, 12, 18, 24, 30, 36) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE client_id = vehicle_rec.client_id
          AND reason LIKE '%revisão%' || months_owned || ' meses%'
          AND created_at > now() - interval '25 days'
      ) THEN
        INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source, status)
        VALUES (
          vehicle_rec.client_id, 'value',
          '🛡️ Revisão ' || months_owned || ' meses - ' || vehicle_rec.brand || ' ' || vehicle_rec.model || ' de ' || vehicle_rec.name,
          CURRENT_DATE, 5, 'auto', 'pending'
        );
        INSERT INTO public.interactions (client_id, type, content, created_by)
        VALUES (vehicle_rec.client_id, 'system',
          'Lembrete de revisão ' || months_owned || ' meses criado para ' || vehicle_rec.brand || ' ' || vehicle_rec.model,
          'system');
      END IF;
    END IF;
  END LOOP;

  -- Annual IPVA/licensing reminder (January)
  IF EXTRACT(MONTH FROM CURRENT_DATE) = 1 AND EXTRACT(DAY FROM CURRENT_DATE) <= 7 THEN
    FOR vehicle_rec IN
      SELECT v.client_id, c.name, v.brand, v.model
      FROM public.vehicles v
      JOIN public.clients c ON c.id = v.client_id
      WHERE v.status = 'current' AND c.status != 'lost'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE client_id = vehicle_rec.client_id
          AND reason LIKE '%IPVA%'
          AND created_at > now() - interval '30 days'
      ) THEN
        INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source, status)
        VALUES (
          vehicle_rec.client_id, 'value',
          '📋 Lembrete IPVA/Licenciamento - ' || vehicle_rec.brand || ' ' || vehicle_rec.model || ' de ' || vehicle_rec.name,
          CURRENT_DATE + 7, 4, 'auto', 'pending'
        );
      END IF;
    END LOOP;
  END IF;
END;
$$;