CREATE OR REPLACE FUNCTION public.trigger_cadence_on_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    IF NEW.pipeline_stage NOT IN ('closed_won', 'closed_lost') THEN
      PERFORM public.start_cadence(NEW.id, NEW.pipeline_stage::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;