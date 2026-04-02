
-- New priority score calculation with behavioral signals
CREATE OR REPLACE FUNCTION public.calculate_priority_score(client_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Has simulation = asked for installment
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

  RETURN GREATEST(score, 0);
END;
$$;

-- Churn risk calculation
CREATE OR REPLACE FUNCTION public.calculate_churn_risk(client_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  risk INTEGER := 0;
  client_rec RECORD;
  hours_since_contact NUMERIC;
  hours_in_stage NUMERIC;
  broken_promises INTEGER;
BEGIN
  SELECT * INTO client_rec FROM public.clients WHERE id = client_id_param;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Skip closed leads
  IF client_rec.pipeline_stage IN ('closed_won', 'closed_lost') THEN RETURN 0; END IF;

  -- Time without interaction (0-25)
  IF client_rec.last_contact_at IS NOT NULL THEN
    hours_since_contact := EXTRACT(EPOCH FROM now() - client_rec.last_contact_at) / 3600;
    risk := risk + CASE
      WHEN hours_since_contact > 72 THEN 25
      WHEN hours_since_contact > 48 THEN 15
      WHEN hours_since_contact > 24 THEN 5
      ELSE 0 END;
  ELSE
    risk := risk + 15;
  END IF;

  -- Broken promises (0-20)
  broken_promises := 0;
  IF client_rec.client_promise_status = 'broken' THEN broken_promises := broken_promises + 1; END IF;
  IF client_rec.client_promise_status = 'overdue' THEN broken_promises := broken_promises + 1; END IF;
  risk := risk + LEAST(broken_promises * 10, 20);

  -- Temperature decay (0-15)
  risk := risk + CASE client_rec.temperature
    WHEN 'frozen' THEN 15 WHEN 'cold' THEN 10 WHEN 'warm' THEN 3 ELSE 0 END;

  -- No next action (0-15)
  IF client_rec.next_action IS NULL AND client_rec.pipeline_stage NOT IN ('new') THEN
    risk := risk + 15;
  END IF;

  -- Hard objection (0-10)
  risk := risk + CASE client_rec.objection_type
    WHEN 'credit' THEN 10 WHEN 'trust' THEN 10 WHEN 'comparison' THEN 8
    WHEN 'timing' THEN 5 WHEN 'indecision' THEN 4
    ELSE 0 END;

  -- Stage stagnation (0-15)
  hours_in_stage := EXTRACT(EPOCH FROM now() - client_rec.updated_at) / 3600;
  risk := risk + CASE
    WHEN hours_in_stage > 120 THEN 15
    WHEN hours_in_stage > 72 THEN 8
    ELSE 0 END;

  RETURN LEAST(risk, 100);
END;
$$;

-- Update the existing lead_score trigger to also update priority_score and churn_risk
CREATE OR REPLACE FUNCTION public.auto_update_lead_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.clients 
  SET 
    lead_score = public.calculate_lead_score(NEW.client_id),
    priority_score = public.calculate_priority_score(NEW.client_id),
    churn_risk = public.calculate_churn_risk(NEW.client_id)
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;
