-- Auto-create follow-up task when new client arrives
CREATE OR REPLACE FUNCTION public.auto_create_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tasks (client_id, type, reason, due_date, priority, source)
  VALUES (
    NEW.id,
    'follow_up',
    CASE 
      WHEN NEW.temperature = 'hot' THEN 'Lead QUENTE - contatar IMEDIATAMENTE'
      WHEN NEW.interest = 'Quero comprar uma moto' THEN 'Novo lead interessado em compra'
      WHEN NEW.interest = 'Quero trocar minha moto' THEN 'Novo lead quer trocar moto'
      WHEN NEW.interest = 'Quero vender minha moto' THEN 'Novo lead quer vender moto'
      WHEN NEW.interest = 'Preciso de dinheiro' THEN 'Novo lead precisa de refinanciamento'
      ELSE 'Novo lead - fazer primeiro contato'
    END,
    CURRENT_DATE,
    CASE WHEN NEW.temperature = 'hot' THEN 10 ELSE 5 END,
    'auto'
  );
  
  -- Also create a system interaction
  INSERT INTO public.interactions (client_id, type, content, created_by)
  VALUES (
    NEW.id,
    'system',
    'Lead capturado pelo funil. Interesse: ' || COALESCE(NEW.interest, 'não informado') || '. Orçamento: ' || COALESCE(NEW.budget_range, 'não informado'),
    'system'
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_follow_up
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_follow_up();

-- Auto-update lead_score after interactions
CREATE OR REPLACE FUNCTION public.auto_update_lead_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients 
  SET lead_score = public.calculate_lead_score(NEW.client_id)
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_score_on_interaction
  AFTER INSERT ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_lead_score();

-- Auto-cool leads that haven't been contacted in 3+ days
CREATE OR REPLACE FUNCTION public.auto_cool_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- warm → cold after 3 days without contact
  UPDATE public.clients
  SET temperature = 'cold'
  WHERE temperature = 'warm'
    AND pipeline_stage NOT IN ('closed_won', 'closed_lost')
    AND (last_contact_at IS NULL OR last_contact_at < now() - interval '3 days')
    AND created_at < now() - interval '3 days';
    
  -- cold → frozen after 7 days  
  UPDATE public.clients
  SET temperature = 'frozen'
  WHERE temperature = 'cold'
    AND pipeline_stage NOT IN ('closed_won', 'closed_lost')
    AND (last_contact_at IS NULL OR last_contact_at < now() - interval '7 days')
    AND created_at < now() - interval '7 days';
END;
$$;