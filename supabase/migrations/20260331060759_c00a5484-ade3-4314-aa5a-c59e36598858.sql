
-- Create new enums
CREATE TYPE public.deal_type AS ENUM ('cash', 'financing_down', 'financing_full', 'trade_financing', 'trade_only');
CREATE TYPE public.objection_type AS ENUM ('price', 'down_payment', 'installment', 'credit', 'trust', 'comparison', 'trade_undervalued', 'indecision', 'timing', 'none');
CREATE TYPE public.loss_reason AS ENUM ('price_too_high', 'no_down_payment', 'installment_too_high', 'credit_denied', 'bought_elsewhere', 'better_offer', 'trade_value_disagreement', 'ghosted', 'postponed', 'changed_mind', 'vehicle_sold', 'slow_response', 'other');
CREATE TYPE public.next_action_type AS ENUM ('call', 'send_proposal', 'send_message', 'collect_docs', 'follow_up', 'schedule_visit', 'submit_credit', 'wait_client', 'close_deal', 'send_content');
CREATE TYPE public.client_promise_status AS ENUM ('pending', 'overdue', 'fulfilled', 'broken');
CREATE TYPE public.credit_status AS ENUM ('pending', 'submitted', 'approved', 'denied', 'renegotiating');
CREATE TYPE public.docs_status AS ENUM ('incomplete', 'collecting', 'complete');

-- Add new columns to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deal_type public.deal_type;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS objection_type public.objection_type;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS loss_reason public.loss_reason;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS loss_notes text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deal_value numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estimated_margin numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS approval_probability integer;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS credit_status public.credit_status;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS docs_status public.docs_status;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_action_type public.next_action_type;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_action_due timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_promise text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_promise_due timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_promise_status public.client_promise_status;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS churn_risk integer DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS priority_score integer DEFAULT 0;
