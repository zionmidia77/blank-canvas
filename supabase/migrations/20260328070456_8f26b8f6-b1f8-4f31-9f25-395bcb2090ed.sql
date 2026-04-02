CREATE TABLE public.employer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cnpj text,
  employer_name text,
  company_name text,
  trading_name text,
  sector text,
  size text,
  status text,
  location text,
  address text,
  founded_year text,
  legal_nature text,
  share_capital numeric,
  reliability_score integer,
  verified boolean DEFAULT false,
  cnpj_validated boolean DEFAULT false,
  source text,
  risk_flags jsonb DEFAULT '[]'::jsonb,
  positive_flags jsonb DEFAULT '[]'::jsonb,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employer_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage employer_verifications"
  ON public.employer_verifications FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_employer_verifications_client ON public.employer_verifications(client_id);
CREATE INDEX idx_employer_verifications_cnpj ON public.employer_verifications(cnpj);