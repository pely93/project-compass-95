CREATE OR REPLACE FUNCTION public.sync_task_visibility()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Backward compat: if legacy is_internal=true set on insert with default visibility, promote to 'interna'
  IF TG_OP = 'INSERT' AND NEW.is_internal = true AND NEW.visibility = 'compartida' THEN
    NEW.visibility := 'interna';
  END IF;
  IF NEW.visibility = 'interna' THEN
    NEW.is_internal := true;
    NEW.impacts_pm_progress := false;
  ELSIF NEW.visibility = 'visible_pm' THEN
    NEW.is_internal := false;
    NEW.impacts_pm_progress := true;
  ELSE
    NEW.is_internal := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_visibility ON public.tasks;
CREATE TRIGGER trg_sync_task_visibility
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_visibility();

REVOKE EXECUTE ON FUNCTION public.sync_task_visibility() FROM PUBLIC, anon, authenticated;