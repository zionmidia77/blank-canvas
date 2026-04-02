
-- =============================================
-- ARSENAL MOTORS - DATABASE SCHEMA
-- =============================================

-- 1. Enums
CREATE TYPE public.client_status AS ENUM ('lead', 'active', 'inactive', 'lost');
CREATE TYPE public.lead_temperature AS ENUM ('hot', 'warm', 'cold', 'frozen');
CREATE TYPE public.pipeline_stage AS ENUM ('new', 'contacted', 'interested', 'negotiating', 'closed_won', 'closed_lost');
CREATE TYPE public.interaction_type AS ENUM ('whatsapp', 'call', 'visit', 'system', 'email', 'sms');
CREATE TYPE public.opportunity_type AS ENUM ('trade', 'refinance', 'upsell', 'reactivation', 'birthday', 'milestone');
CREATE TYPE public.task_type AS ENUM ('opportunity', 'relationship', 'value', 'follow_up');
CREATE TYPE public.vehicle_status AS ENUM ('current', 'sold', 'traded');

-- 2. Auto-update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  city TEXT,
  birthdate DATE,
  source TEXT DEFAULT 'funnel',
  status client_status NOT NULL DEFAULT 'lead',
  temperature lead_temperature NOT NULL DEFAULT 'warm',
  pipeline_stage pipeline_stage NOT NULL DEFAULT 'new',
  lead_score INTEGER NOT NULL DEFAULT 0,
  arsenal_score INTEGER NOT NULL DEFAULT 0,
  interest TEXT,
  budget_range TEXT,
  has_trade_in BOOLEAN DEFAULT false,
  notes TEXT,
  referred_by UUID REFERENCES public.clients(id),
  funnel_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  km INTEGER,
  estimated_value NUMERIC(12,2),
  is_financed BOOLEAN DEFAULT false,
  installments_paid INTEGER DEFAULT 0,
  installments_total INTEGER DEFAULT 0,
  monthly_payment NUMERIC(12,2),
  status vehicle_status NOT NULL DEFAULT 'current',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Interactions table
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type interaction_type NOT NULL DEFAULT 'system',
  content TEXT NOT NULL,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on interactions" ON public.interactions FOR ALL USING (true) WITH CHECK (true);

-- 6. Opportunities table
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type opportunity_type NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  title TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on opportunities" ON public.opportunities FOR ALL USING (true) WITH CHECK (true);

-- 7. Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type task_type NOT NULL DEFAULT 'follow_up',
  reason TEXT NOT NULL,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- 8. Referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_client_id UUID REFERENCES public.clients(id),
  referred_name TEXT,
  referred_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reward_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on referrals" ON public.referrals FOR ALL USING (true) WITH CHECK (true);

-- 9. Message templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT DEFAULT '💬',
  message TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);

-- 10. Messages sent log
CREATE TABLE public.messages_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.message_templates(id),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message_content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on messages_sent" ON public.messages_sent FOR ALL USING (true) WITH CHECK (true);

-- 11. Indexes
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_clients_temperature ON public.clients(temperature);
CREATE INDEX idx_clients_pipeline ON public.clients(pipeline_stage);
CREATE INDEX idx_clients_score ON public.clients(lead_score DESC);
CREATE INDEX idx_vehicles_client ON public.vehicles(client_id);
CREATE INDEX idx_interactions_client ON public.interactions(client_id);
CREATE INDEX idx_interactions_date ON public.interactions(created_at DESC);
CREATE INDEX idx_opportunities_client ON public.opportunities(client_id);
CREATE INDEX idx_opportunities_status ON public.opportunities(status);
CREATE INDEX idx_tasks_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);

-- 12. Seed message templates
INSERT INTO public.message_templates (title, category, emoji, message, variables) VALUES
('Primeiro contato', 'lead', '👋', 'Fala {nome}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em motos. Posso te ajudar a encontrar a ideal?', ARRAY['nome']),
('Follow-up 3 dias', 'lead', '🔄', 'E aí {nome}, tudo bem? Lembra que conversamos sobre motos? Ainda tá pensando? Tenho umas condições especiais essa semana 🔥', ARRAY['nome']),
('Aniversário', 'relacionamento', '🎂', 'Parabéns {nome}! 🎉 Todo mundo aqui da Arsenal te deseja tudo de bom! Se precisar de algo, é só chamar 🤙', ARRAY['nome']),
('Moto valorizada', 'oportunidade', '📈', '{nome}, sua {moto} tá super valorizada no mercado agora! Quer saber quanto consegue por ela?', ARRAY['nome', 'moto']),
('Parcela melhor', 'oportunidade', '💰', 'Ei {nome}! Achei uma condição que pode baixar sua parcela. Quer dar uma olhada? Sem compromisso 😉', ARRAY['nome']),
('Pós-venda', 'relacionamento', '💪', 'Fala {nome}! Como tá a {moto}? Qualquer coisa que precisar, estamos aqui. Arsenal Motors cuida de você 💪', ARRAY['nome', 'moto']),
('Moto quitada', 'oportunidade', '🎯', 'Parabéns {nome}! Sua {moto} tá quitada! 🎉 Ótimo momento pra trocar por uma mais nova. Quer ver as opções?', ARRAY['nome', 'moto']),
('Reativação', 'relacionamento', '👀', 'Fala {nome}! Sumiu, hein! 😄 Tá tudo bem? Aqui na Arsenal tem novidades que você vai curtir. Bora conversar?', ARRAY['nome']);

-- 13. Lead scoring function
CREATE OR REPLACE FUNCTION public.calculate_lead_score(client_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score INTEGER := 0;
  client_record RECORD;
  interaction_count INTEGER;
  days_since INTEGER;
BEGIN
  SELECT * INTO client_record FROM public.clients WHERE id = client_id_param;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF client_record.phone IS NOT NULL THEN score := score + 15; END IF;
  IF client_record.name IS NOT NULL THEN score := score + 5; END IF;
  IF client_record.interest IS NOT NULL THEN score := score + 10; END IF;
  IF client_record.has_trade_in THEN score := score + 15; END IF;
  
  IF client_record.budget_range = 'Acima de R$ 50 mil' THEN score := score + 15;
  ELSIF client_record.budget_range = 'R$ 30 a 50 mil' THEN score := score + 12;
  ELSIF client_record.budget_range = 'R$ 15 a 30 mil' THEN score := score + 10;
  ELSE score := score + 5;
  END IF;

  SELECT COUNT(*) INTO interaction_count FROM public.interactions WHERE client_id = client_id_param;
  score := score + LEAST(interaction_count * 3, 20);

  SELECT EXTRACT(DAY FROM now() - MAX(created_at))::INTEGER INTO days_since
  FROM public.interactions WHERE client_id = client_id_param;
  
  IF days_since IS NOT NULL THEN
    score := score - LEAST(days_since * 2, 30);
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referrer_id = client_id_param) THEN
    score := score + 15;
  END IF;

  RETURN GREATEST(score, 0);
END;
$$;
