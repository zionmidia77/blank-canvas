
-- Fix: Remove the internal UPDATE from calculate_priority_score to avoid "tuple already modified" conflict
-- The queue_reason will be set by the caller (auto_update_lead_score trigger) instead.

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
BEGIN
  SELECT * INTO client_rec FROM public.clients WHERE id = client_id_param;
  IF NOT FOUND THEN RETURN 0; END IF;

  score := score + CASE client_rec.temperature
    WHEN 'hot' THEN 10 WHEN 'warm' THEN 5 WHEN 'cold' THEN 2 ELSE 0 END;

  IF client_rec.response_time_hours IS NOT NULL THEN
    score := score + CASE
      WHEN client_rec.response_time_hours <= 1 THEN 8
      WHEN client_rec.response_time_hours <= 4 THEN 5
      WHEN client_rec.response_time_hours <= 12 THEN 2
      ELSE 0 END;
  END IF;

  SELECT COUNT(*) INTO recent_interactions FROM public.interactions
  WHERE client_id = client_id_param AND created_at > now() - interval '48 hours';
  score := score + CASE WHEN recent_interactions >= 3 THEN 7 WHEN recent_interactions >= 1 THEN 3 ELSE 0 END;

  SELECT EXISTS(SELECT 1 FROM public.financing_simulations WHERE client_id = client_id_param) INTO has_simulation;
  IF has_simulation THEN score := score + 10; END IF;
  IF client_rec.has_down_payment THEN score := score + 5; END IF;
  IF client_rec.has_clean_credit THEN score := score + 5; END IF;

  score := score + CASE client_rec.docs_status
    WHEN 'complete' THEN 10 WHEN 'collecting' THEN 6 ELSE 0 END;

  IF client_rec.deal_value IS NOT NULL AND client_rec.deal_value > 0 THEN
    score := score + LEAST((client_rec.deal_value / 5000)::integer, 12);
  END IF;

  IF client_rec.estimated_margin IS NOT NULL AND client_rec.estimated_margin > 0 THEN
    score := score + LEAST((client_rec.estimated_margin / 1000)::integer, 8);
  END IF;

  IF client_rec.approval_probability IS NOT NULL THEN
    score := score + (client_rec.approval_probability * 8 / 100);
  END IF;

  score := score + CASE client_rec.objection_type
    WHEN 'price' THEN 5 WHEN 'down_payment' THEN 5 WHEN 'installment' THEN 4
    WHEN 'indecision' THEN 2 WHEN 'timing' THEN 1
    WHEN 'credit' THEN -3 WHEN 'trust' THEN -3
    ELSE 0 END;

  IF client_rec.next_action IS NULL AND client_rec.pipeline_stage NOT IN ('new', 'closed_won', 'closed_lost') THEN
    score := score - 10;
  END IF;

  IF client_rec.last_contact_at IS NOT NULL THEN
    hours_since_contact := EXTRACT(EPOCH FROM now() - client_rec.last_contact_at) / 3600;
    score := score - LEAST((hours_since_contact / 24)::integer * 3, 20);
  END IF;

  RETURN GREATEST(score, 0);
END;
$function$;

-- New helper function to calculate queue_reason without updating the row
CREATE OR REPLACE FUNCTION public.calculate_queue_reason(client_id_param uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  client_rec RECORD;
BEGIN
  SELECT * INTO client_rec FROM public.clients WHERE id = client_id_param;
  IF NOT FOUND THEN RETURN 'standard'; END IF;

  IF client_rec.client_promise_status = 'overdue' THEN
    RETURN 'promise_overdue';
  ELSIF client_rec.next_action_due IS NOT NULL AND client_rec.next_action_due < now() THEN
    RETURN 'action_overdue';
  ELSIF client_rec.last_contact_at IS NULL OR client_rec.last_contact_at < now() - interval '48 hours' THEN
    RETURN 'no_contact_48h';
  ELSIF client_rec.next_action_due IS NOT NULL 
        AND client_rec.next_action_due >= date_trunc('day', now()) 
        AND client_rec.next_action_due < date_trunc('day', now()) + interval '1 day' THEN
    RETURN 'scheduled_today';
  ELSIF client_rec.temperature = 'hot' THEN
    RETURN 'hot_lead';
  ELSE
    RETURN 'standard';
  END IF;
END;
$function$;

-- Update auto_update_lead_score to also set queue_reason in the same UPDATE
CREATE OR REPLACE FUNCTION public.auto_update_lead_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.clients 
  SET 
    lead_score = public.calculate_lead_score(NEW.client_id),
    priority_score = public.calculate_priority_score(NEW.client_id),
    churn_risk = public.calculate_churn_risk(NEW.client_id),
    queue_reason = public.calculate_queue_reason(NEW.client_id)
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$function$;
