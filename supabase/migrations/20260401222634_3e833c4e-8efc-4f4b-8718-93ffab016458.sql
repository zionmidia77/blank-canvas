CREATE OR REPLACE TRIGGER trigger_cadence_on_new_client
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cadence_on_new_client();

CREATE OR REPLACE TRIGGER trigger_cadence_on_stage_change
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cadence_on_stage_change();