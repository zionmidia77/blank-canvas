-- Function: Auto-detect birthdays and create tasks + opportunities
CREATE OR REPLACE FUNCTION public.auto_birthday_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bday_client RECORD;
BEGIN
  FOR bday_client IN
    SELECT id, name, phone
    FROM public.clients
    WHERE birthdate IS NOT NULL
      AND EXTRACT(MONTH FROM birthdate) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM birthdate) = EXTRACT(DAY FROM CURRENT_DATE)
      AND status != 'lost'
  LOOP
    -- Check if birthday task already exists for today
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE client_id = bday_client.id
        AND type = 'relationship'
        AND due_date = CURRENT_DATE
        AND reason LIKE '%aniversário%'
    ) THEN
      INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source, status)
      VALUES (
        bday_client.id, 'relationship',
        '🎂 Aniversário de ' || bday_client.name || '! Enviar parabéns',
        CURRENT_DATE, 9, 'auto', 'pending'
      );

      INSERT INTO public.opportunities (client_id, type, title, message, priority, status)
      VALUES (
        bday_client.id, 'birthday',
        'Aniversário - ' || bday_client.name,
        'Oportunidade de reengajamento: enviar mensagem de parabéns e oferta especial',
        8, 'pending'
      );

      INSERT INTO public.interactions (client_id, type, content, created_by)
      VALUES (bday_client.id, 'system', '🎂 Aniversário detectado! Tarefa criada automaticamente.', 'system');
    END IF;
  END LOOP;
END;
$$;

-- Function: Auto check-in at 30/60/90 days after closed_won
CREATE OR REPLACE FUNCTION public.auto_checkin_schedule()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_rec RECORD;
  days_since INTEGER;
  milestone TEXT;
BEGIN
  FOR client_rec IN
    SELECT c.id, c.name, c.updated_at
    FROM public.clients c
    WHERE c.pipeline_stage = 'closed_won'
      AND c.status = 'active'
  LOOP
    days_since := EXTRACT(DAY FROM now() - client_rec.updated_at)::INTEGER;

    IF days_since IN (30, 60, 90) THEN
      milestone := days_since || ' dias';

      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE client_id = client_rec.id
          AND type = 'relationship'
          AND reason LIKE '%check-in ' || milestone || '%'
      ) THEN
        INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source, status)
        VALUES (
          client_rec.id, 'relationship',
          '📞 Check-in ' || milestone || ' pós-venda com ' || client_rec.name,
          CURRENT_DATE, 6, 'auto', 'pending'
        );

        INSERT INTO public.interactions (client_id, type, content, created_by)
        VALUES (client_rec.id, 'system', 'Check-in ' || milestone || ' pós-venda agendado automaticamente.', 'system');
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Function: Auto trade/upgrade alert at 12 months
CREATE OR REPLACE FUNCTION public.auto_upgrade_alerts()
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
    SELECT v.id, v.client_id, v.brand, v.model, v.year, v.created_at,
           c.name, c.phone
    FROM public.vehicles v
    JOIN public.clients c ON c.id = v.client_id
    WHERE v.status = 'current'
      AND c.status != 'lost'
  LOOP
    months_owned := EXTRACT(MONTH FROM age(now(), vehicle_rec.created_at))
                  + EXTRACT(YEAR FROM age(now(), vehicle_rec.created_at))::INTEGER * 12;

    IF months_owned >= 12 AND months_owned < 13 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.opportunities
        WHERE client_id = vehicle_rec.client_id
          AND type = 'trade'
          AND created_at > now() - interval '30 days'
      ) THEN
        INSERT INTO public.opportunities (client_id, type, title, message, priority, status)
        VALUES (
          vehicle_rec.client_id, 'trade',
          '🔄 Upgrade - ' || vehicle_rec.name,
          vehicle_rec.name || ' tem a ' || vehicle_rec.brand || ' ' || vehicle_rec.model ||
          ' há 12+ meses. Hora de propor upgrade!',
          7, 'pending'
        );

        INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source, status)
        VALUES (
          vehicle_rec.client_id, 'opportunity',
          '🔄 Propor upgrade/troca para ' || vehicle_rec.name || ' (' || vehicle_rec.brand || ' ' || vehicle_rec.model || ')',
          CURRENT_DATE, 7, 'auto', 'pending'
        );

        INSERT INTO public.interactions (client_id, type, content, created_by)
        VALUES (vehicle_rec.client_id, 'system',
          'Alerta de upgrade: ' || vehicle_rec.brand || ' ' || vehicle_rec.model || ' com 12+ meses. Oportunidade criada.',
          'system');
      END IF;
    END IF;
  END LOOP;
END;
$$;