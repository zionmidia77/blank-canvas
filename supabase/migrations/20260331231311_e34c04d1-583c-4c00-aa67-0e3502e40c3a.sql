
-- Trigger function to auto-increment leads_captured_today when a bot_log with lead_created=true is inserted
CREATE OR REPLACE FUNCTION public.increment_bot_leads_today()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lead_created = true THEN
    -- Reset counter if last_reset_at is not today
    UPDATE public.bot_configs
    SET 
      leads_captured_today = CASE 
        WHEN last_reset_at IS NULL OR last_reset_at < CURRENT_DATE 
        THEN 1 
        ELSE leads_captured_today + 1 
      END,
      last_reset_at = CURRENT_DATE,
      updated_at = now()
    WHERE id = NEW.bot_config_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger on bot_logs
CREATE TRIGGER trg_increment_bot_leads
  AFTER INSERT ON public.bot_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_bot_leads_today();
