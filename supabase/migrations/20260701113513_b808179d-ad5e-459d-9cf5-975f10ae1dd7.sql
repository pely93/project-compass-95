-- Añadir campos de seguimiento avanzado a tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'compartida' CHECK (visibility IN ('interna','compartida','visible_pm')),
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS actual_date DATE,
  ADD COLUMN IF NOT EXISTS impacts_pm_progress BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dependencies TEXT;

-- Añadir horas estimadas a fases
ALTER TABLE public.phases
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2);

-- Mantener is_internal sincronizado con visibility para RLS existente
CREATE OR REPLACE FUNCTION public.sync_task_visibility()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
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
  BEFORE INSERT OR UPDATE OF visibility ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_visibility();
