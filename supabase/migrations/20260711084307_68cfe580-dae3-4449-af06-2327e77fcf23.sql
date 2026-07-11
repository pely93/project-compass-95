
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_auth" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.uid() IS NULL);

CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

-- Trigger: create notification on task assignment
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  task_title text;
BEGIN
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;
  IF NEW.assignee_id = actor THEN
    RETURN NEW;
  END IF;
  task_title := COALESCE(NEW.title, 'Tarea');
  INSERT INTO public.notifications (user_id, type, title, body, task_id, actor_id)
  VALUES (
    NEW.assignee_id,
    'task_assigned',
    'Nueva tarea asignada',
    task_title,
    NEW.id,
    actor
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_assignment
AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- Time entries: pause/resume + submit-to-PM
ALTER TABLE public.time_entries
  ADD COLUMN is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN total_paused_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN is_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN submitted_at timestamptz;

-- PM can view submitted time entries
CREATE POLICY "PM can view submitted time entries" ON public.time_entries
  FOR SELECT USING (
    is_submitted = true AND has_role(auth.uid(), 'project_manager'::app_role)
  );
