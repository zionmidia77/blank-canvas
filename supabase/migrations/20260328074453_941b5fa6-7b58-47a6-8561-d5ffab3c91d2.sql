
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  transferred_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert chat_conversations" ON public.chat_conversations
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update own chat_conversations" ON public.chat_conversations
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage chat_conversations" ON public.chat_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
