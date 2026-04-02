
-- Add substatus enum
CREATE TYPE public.client_substatus AS ENUM ('active', 'scheduled', 'waiting_client', 'thinking', 'no_response', 'docs_pending');

-- Add substatus and queue_reason columns to clients
ALTER TABLE public.clients ADD COLUMN substatus public.client_substatus DEFAULT 'active';
ALTER TABLE public.clients ADD COLUMN queue_reason text;

-- Update calculate_priority_score to also set queue_reason
CREATE OR REPLACE FUNCTION public.calculate_priority_score(client_id_param uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  score INTEGER := 0;
  client_rec RECORD;
  interaction_count INTEGER;
  recent_interactions INTEGER;
  hours_since_contact NUMERIC;
  has_simulation BOOLEAN;
  computed_reason TEXT := 'standard';
BEGIN
  SELECT * INTO client_rec FROM public.clients WHERE id = client_id_param;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Temperature (0-10)
  score := score + CASE client_rec.temperature
    WHEN 'hot' THEN 10 WHEN 'warm' THEN 5 WHEN 'cold' THEN 2 ELSE 0 END;

  -- Response speed (0-8)
  IF client_rec.response_time_hours IS NOT NULL THEN
    score := score + CASE
      WHEN client_rec.response_time_hours <= 1 THEN 8
      WHEN client_rec.response_time_hours <= 4 THEN 5
      WHEN client_rec.response_time_hours <= 12 THEN 2
      ELSE 0 END;
  END IF;

  -- Recent engagement: 3+ interactions in 48h (0-7)
  SELECT COUNT(*) INTO recent_interactions FROM public.interactions
  WHERE client_id = client_id_param AND created_at > now() - interval '48 hours';
  score := score + CASE WHEN recent_interactions >= 3 THEN 7 WHEN recent_interactions >= 1 THEN 3 ELSE 0 END;

  -- Purchase intent signals (0-15)
  SELECT EXISTS(SELECT 1 FROM public.financing_simulations WHERE client_id = client_id_param) INTO has_simulation;
  IF has_simulation THEN score := score + 10; END IF;
  IF client_rec.has_down_payment THEN score := score + 5; END IF;
  IF client_rec.has_clean_credit THEN score := score + 5; END IF;

  -- Docs submitted (0-10)
  score := score + CASE client_rec.docs_status
    WHEN 'complete' THEN 10 WHEN 'collecting' THEN 6 ELSE 0 END;

  -- Deal value normalized (0-12)
  IF client_rec.deal_value IS NOT NULL AND client_rec.deal_value > 0 THEN
    score := score + LEAST((client_rec.deal_value / 5000)::integer, 12);
  END IF;

  -- Estimated margin (0-8)
  IF client_rec.estimated_margin IS NOT NULL AND client_rec.estimated_margin > 0 THEN
    score := score + LEAST((client_rec.estimated_margin / 1000)::integer, 8);
  END IF;

  -- Approval probability (0-8)
  IF client_rec.approval_probability IS NOT NULL THEN
    score := score + (client_rec.approval_probability * 8 / 100);
  END IF;

  -- Objection resolvability (0-5 or -3)
  score := score + CASE client_rec.objection_type
    WHEN 'price' THEN 5 WHEN 'down_payment' THEN 5 WHEN 'installment' THEN 4
    WHEN 'indecision' THEN 2 WHEN 'timing' THEN 1
    WHEN 'credit' THEN -3 WHEN 'trust' THEN -3
    ELSE 0 END;

  -- Next action penalty (-10 if missing)
  IF client_rec.next_action IS NULL AND client_rec.pipeline_stage NOT IN ('new', 'closed_won', 'closed_lost') THEN
    score := score - 10;
  END IF;

  -- Inactivity decay (-3 per 24h)
  IF client_rec.last_contact_at IS NOT NULL THEN
    hours_since_contact := EXTRACT(EPOCH FROM now() - client_rec.last_contact_at) / 3600;
    score := score - LEAST((hours_since_contact / 24)::integer * 3, 20);
  END IF;

  -- Determine queue_reason (highest priority reason)
  IF client_rec.client_promise_status = 'overdue' THEN
    computed_reason := 'promise_overdue';
  ELSIF client_rec.next_action_due IS NOT NULL AND client_rec.next_action_due < now() THEN
    computed_reason := 'action_overdue';
  ELSIF client_rec.last_contact_at IS NULL OR client_rec.last_contact_at < now() - interval '48 hours' THEN
    computed_reason := 'no_contact_48h';
  ELSIF client_rec.next_action_due IS NOT NULL 
        AND client_rec.next_action_due >= date_trunc('day', now()) 
        AND client_rec.next_action_due < date_trunc('day', now()) + interval '1 day' THEN
    computed_reason := 'scheduled_today';
  ELSIF client_rec.temperature = 'hot' THEN
    computed_reason := 'hot_lead';
  ELSE
    computed_reason := 'standard';
  END IF;

  -- Save queue_reason on the client
  UPDATE public.clients SET queue_reason = computed_reason WHERE id = client_id_param;

  RETURN GREATEST(score, 0);
END;
$function$;

-- Update advance_cadence to only cancel cadence-source tasks (not manual or auto)
CREATE OR REPLACE FUNCTION public.advance_cadence()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  step RECORD;
  pending_count integer;
  client_rec RECORD;
BEGIN
  FOR step IN
    SELECT cs.*, ct.action_type, ct.task_reason, ct.suggested_message
    FROM public.cadence_steps cs
    JOIN public.cadence_templates ct ON ct.id = cs.template_id
    WHERE cs.completed_at IS NULL
      AND cs.skipped = false
      AND cs.scheduled_for <= now()
      AND cs.task_id IS NULL
    ORDER BY cs.scheduled_for
  LOOP
    -- Get client info
    SELECT * INTO client_rec FROM public.clients WHERE id = step.client_id;

    -- Skip if client responded recently
    IF client_rec.last_contact_at IS NOT NULL 
       AND client_rec.last_contact_at > step.created_at THEN
      UPDATE public.cadence_steps SET skipped = true WHERE id = step.id;
      CONTINUE;
    END IF;

    -- Skip closed leads
    IF client_rec.pipeline_stage IN ('closed_won', 'closed_lost') THEN
      UPDATE public.cadence_steps SET skipped = true WHERE id = step.id;
      CONTINUE;
    END IF;

    -- Skip if client has pending promise (not overdue)
    IF client_rec.client_promise_status = 'pending' THEN
      CONTINUE;
    END IF;

    -- Limit: max 2 pending CADENCE tasks per lead (only count cadence-source tasks)
    SELECT COUNT(*) INTO pending_count
    FROM public.tasks
    WHERE client_id = step.client_id AND status = 'pending' AND source = 'cadence';

    IF pending_count >= 2 THEN
      CONTINUE;
    END IF;

    -- Cancel previous pending cadence tasks for this lead (category-based)
    UPDATE public.tasks 
    SET status = 'cancelled', completed_at = now()
    WHERE client_id = step.client_id 
      AND status = 'pending' 
      AND source = 'cadence';

    -- Create task
    INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source, notes, status)
    VALUES (
      step.client_id,
      'follow_up',
      step.task_reason,
      CURRENT_DATE,
      CASE WHEN client_rec.temperature = 'hot' THEN 9
           WHEN client_rec.temperature = 'warm' THEN 7
           ELSE 5 END,
      'cadence',
      COALESCE(step.suggested_message, ''),
      'pending'
    )
    RETURNING id INTO step.task_id;

    -- Link task to cadence step
    UPDATE public.cadence_steps SET task_id = step.task_id WHERE id = step.id;

    -- Update next_action on client if not set
    IF client_rec.next_action IS NULL THEN
      UPDATE public.clients
      SET next_action = step.task_reason,
          next_action_type = step.action_type::next_action_type,
          next_action_due = now()
      WHERE id = step.client_id;
    END IF;
  END LOOP;
END;
$function$;
