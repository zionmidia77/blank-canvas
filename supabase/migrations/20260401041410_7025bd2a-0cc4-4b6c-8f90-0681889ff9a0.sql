
-- Table: cadence templates (configurable per pipeline_stage)
CREATE TABLE public.cadence_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_stage text NOT NULL,
  step_number integer NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  action_type text NOT NULL DEFAULT 'follow_up',
  suggested_message text,
  task_reason text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_stage, step_number)
);

ALTER TABLE public.cadence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage cadence_templates"
  ON public.cadence_templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Table: cadence steps (tracks progress per client)
CREATE TABLE public.cadence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.cadence_templates(id) ON DELETE CASCADE,
  pipeline_stage text NOT NULL,
  step_number integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  completed_at timestamptz,
  skipped boolean NOT NULL DEFAULT false,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage cadence_steps"
  ON public.cadence_steps FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_cadence_steps_client ON public.cadence_steps(client_id);
CREATE INDEX idx_cadence_steps_scheduled ON public.cadence_steps(scheduled_for) WHERE completed_at IS NULL AND skipped = false;

-- Seed default cadence templates
INSERT INTO public.cadence_templates (pipeline_stage, step_number, delay_days, action_type, task_reason, suggested_message) VALUES
-- new
('new', 1, 0, 'call', '📞 Contato inicial', 'Olá {nome}! Vi seu interesse, posso te ajudar?'),
('new', 2, 1, 'send_message', '💬 Follow-up dia 1', '{nome}, conseguiu pensar sobre o que conversamos?'),
('new', 3, 3, 'send_message', '📄 Reforço dia 3', '{nome}, separei algumas opções especiais para você!'),
('new', 4, 5, 'send_message', '🎯 Oferta dia 5', '{nome}, temos uma condição especial essa semana...'),
('new', 5, 7, 'send_message', '⚠️ Última tentativa', '{nome}, essa é minha última tentativa. Posso ajudar?'),
-- first_contact
('first_contact', 1, 1, 'send_message', '💬 Follow-up primeiro contato', 'Conseguiu ver as opções que enviei?'),
('first_contact', 2, 3, 'call', '📞 Reforço por ligação', NULL),
('first_contact', 3, 5, 'send_message', '🎯 Oferta especial', '{nome}, tenho algo especial para você!'),
('first_contact', 4, 7, 'send_message', '⚠️ Última tentativa', '{nome}, ainda tem interesse?'),
-- proposal_sent
('proposal_sent', 1, 1, 'send_message', '💬 Recebeu a proposta?', '{nome}, conseguiu analisar a proposta?'),
('proposal_sent', 2, 2, 'call', '📞 Discutir proposta', NULL),
('proposal_sent', 3, 3, 'send_message', '🔥 Criar urgência', '{nome}, essa condição é válida até sexta!'),
('proposal_sent', 4, 5, 'send_message', '⚠️ Última oferta', '{nome}, posso melhorar algo na proposta?'),
-- negotiation
('negotiation', 1, 1, 'send_message', '💬 Follow-up negociação', '{nome}, pensou sobre nossa conversa?'),
('negotiation', 2, 2, 'call', '📞 Ligar para fechar', NULL),
('negotiation', 3, 3, 'send_message', '🔥 Oferta final', '{nome}, consigo segurar essa condição até amanhã!'),
('negotiation', 4, 5, 'send_message', '⚠️ Última tentativa', '{nome}, última chance nessa condição!'),
-- qualification
('qualification', 1, 2, 'send_message', '📋 Pedir informações', '{nome}, preciso de alguns dados para avançar...'),
('qualification', 2, 5, 'call', '📞 Cobrar resposta', NULL),
('qualification', 3, 7, 'send_message', '⚠️ Última tentativa', '{nome}, ainda quer seguir com o processo?'),
-- waiting_response
('waiting_response', 1, 3, 'send_message', '💬 Lembrete suave', '{nome}, tudo bem? Estou à disposição!'),
('waiting_response', 2, 7, 'call', '📞 Ligar para reativar', NULL);

-- Function: start cadence for a client
CREATE OR REPLACE FUNCTION public.start_cadence(p_client_id uuid, p_pipeline_stage text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tpl RECORD;
  base_date timestamptz;
  actual_delay integer;
  client_rec RECORD;
BEGIN
  -- Cancel existing cadence for this client
  UPDATE public.cadence_steps
  SET skipped = true
  WHERE client_id = p_client_id
    AND completed_at IS NULL
    AND skipped = false;

  -- Get client info for dynamic priority
  SELECT temperature, client_promise_status INTO client_rec
  FROM public.clients WHERE id = p_client_id;

  base_date := now();

  FOR tpl IN
    SELECT * FROM public.cadence_templates
    WHERE pipeline_stage = p_pipeline_stage AND is_active = true
    ORDER BY step_number
  LOOP
    -- Dynamic priority: accelerate for hot leads or overdue promises
    actual_delay := tpl.delay_days;
    IF client_rec.temperature = 'hot' OR client_rec.client_promise_status = 'overdue' THEN
      actual_delay := GREATEST(FLOOR(tpl.delay_days * 0.5)::integer, 0);
    END IF;

    INSERT INTO public.cadence_steps (client_id, template_id, pipeline_stage, step_number, scheduled_for)
    VALUES (p_client_id, tpl.id, p_pipeline_stage, tpl.step_number, base_date + (actual_delay || ' days')::interval);
  END LOOP;
END;
$$;

-- Function: advance cadences (run hourly via cron)
CREATE OR REPLACE FUNCTION public.advance_cadence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    -- Skip if client responded recently (last_contact_at within cadence window)
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
      CONTINUE; -- don't skip, just wait
    END IF;

    -- Limit: max 2 pending tasks per lead
    SELECT COUNT(*) INTO pending_count
    FROM public.tasks
    WHERE client_id = step.client_id AND status = 'pending';

    IF pending_count >= 2 THEN
      CONTINUE; -- wait until tasks are completed
    END IF;

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
$$;

-- Trigger: start cadence when pipeline_stage changes
CREATE OR REPLACE FUNCTION public.trigger_cadence_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger on actual stage changes
  IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    -- Don't start cadence for closed stages
    IF NEW.pipeline_stage NOT IN ('closed_won', 'closed_lost') THEN
      PERFORM public.start_cadence(NEW.id, NEW.pipeline_stage);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cadence_on_stage_change
  AFTER UPDATE OF pipeline_stage ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cadence_on_stage_change();

-- Trigger: start cadence when new client is created
CREATE OR REPLACE FUNCTION public.trigger_cadence_on_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pipeline_stage NOT IN ('closed_won', 'closed_lost') THEN
    PERFORM public.start_cadence(NEW.id, NEW.pipeline_stage);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cadence_on_new_client
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cadence_on_new_client();
