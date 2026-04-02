
-- ============================================
-- 1. FIX RLS POLICIES (require authentication)
-- ============================================

-- CLIENTS
DROP POLICY IF EXISTS "Allow all operations on clients" ON public.clients;
CREATE POLICY "Authenticated users can read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon can insert clients via funnel" ON public.clients FOR INSERT TO anon WITH CHECK (true);

-- INTERACTIONS
DROP POLICY IF EXISTS "Allow all operations on interactions" ON public.interactions;
CREATE POLICY "Authenticated users can manage interactions" ON public.interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can insert interactions" ON public.interactions FOR INSERT TO anon WITH CHECK (true);

-- TASKS
DROP POLICY IF EXISTS "Allow all operations on tasks" ON public.tasks;
CREATE POLICY "Authenticated users can manage tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VEHICLES
DROP POLICY IF EXISTS "Allow all operations on vehicles" ON public.vehicles;
CREATE POLICY "Authenticated users can manage vehicles" ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OPPORTUNITIES
DROP POLICY IF EXISTS "Allow all operations on opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users can manage opportunities" ON public.opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- REFERRALS
DROP POLICY IF EXISTS "Allow all operations on referrals" ON public.referrals;
CREATE POLICY "Authenticated users can manage referrals" ON public.referrals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MESSAGE TEMPLATES
DROP POLICY IF EXISTS "Allow all operations on message_templates" ON public.message_templates;
CREATE POLICY "Authenticated users can manage templates" ON public.message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MESSAGES SENT
DROP POLICY IF EXISTS "Allow all operations on messages_sent" ON public.messages_sent;
CREATE POLICY "Authenticated users can manage messages_sent" ON public.messages_sent FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 2. CREATE TAGS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS public.client_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'hsl(0 72% 51%)',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage tags" ON public.client_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.client_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.client_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, tag_id)
);

ALTER TABLE public.client_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage tag assignments" ON public.client_tag_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
