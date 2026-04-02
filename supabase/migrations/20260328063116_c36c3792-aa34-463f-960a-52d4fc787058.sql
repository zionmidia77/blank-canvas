CREATE OR REPLACE FUNCTION public.auto_escalate_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stale_lead RECORD;
BEGIN
  FOR stale_lead IN
    SELECT id, name
    FROM public.clients
    WHERE pipeline_stage = 'contacted'
      AND status NOT IN ('inactive', 'lost')
      AND (
        last_contact_at IS NULL 
        OR last_contact_at < now() - interval '48 hours'
      )
      AND updated_at < now() - interval '48 hours'
  LOOP
    UPDATE public.clients
    SET 
      pipeline_stage = 'waiting_response',
      temperature = CASE 
        WHEN temperature = 'hot' THEN 'warm'
        WHEN temperature = 'warm' THEN 'cold'
        ELSE temperature
      END,
      updated_at = now()
    WHERE id = stale_lead.id;

    INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source, status)
    VALUES (
      stale_lead.id,
      'follow_up',
      '⚠️ Lead sem resposta há 48h — recontatar urgente',
      CURRENT_DATE,
      8,
      'auto',
      'pending'
    );

    INSERT INTO public.interactions (client_id, type, content, created_by)
    VALUES (
      stale_lead.id,
      'system',
      'Automação: Lead movido para "Aguardando resposta" após 48h sem contato em "Contatado"',
      'system'
    );
  END LOOP;
END;
$$;