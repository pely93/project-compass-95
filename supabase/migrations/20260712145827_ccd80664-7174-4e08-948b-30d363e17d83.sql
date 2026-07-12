
-- 1) Attachments SELECT: only if user can see the parent task
DROP POLICY IF EXISTS attachments_select_auth ON public.attachments;
CREATE POLICY attachments_select_by_task_access ON public.attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = attachments.task_id
        AND (
          public.has_role(auth.uid(), 'developer'::public.app_role)
          OR (
            public.has_role(auth.uid(), 'project_manager'::public.app_role)
            AND (t.type = 'executive'::public.task_type OR t.is_internal = false)
          )
        )
    )
  );

-- 2) task_history SELECT: only if user can see the parent task
DROP POLICY IF EXISTS history_select_auth ON public.task_history;
CREATE POLICY history_select_by_task_access ON public.task_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_history.task_id
        AND (
          public.has_role(auth.uid(), 'developer'::public.app_role)
          OR (
            public.has_role(auth.uid(), 'project_manager'::public.app_role)
            AND (t.type = 'executive'::public.task_type OR t.is_internal = false)
          )
        )
    )
  );

-- 3) Notifications INSERT: disallow direct client inserts.
-- The SECURITY DEFINER trigger notify_task_assignment runs as the function
-- owner and bypasses RLS, so notifications are still created server-side.
DROP POLICY IF EXISTS notif_insert_auth ON public.notifications;
CREATE POLICY notif_insert_none ON public.notifications
  FOR INSERT
  WITH CHECK (false);

-- 4) user_roles SELECT: only allow a user to read their own role.
-- has_role() is SECURITY DEFINER and continues to work for policy checks.
DROP POLICY IF EXISTS user_roles_select_auth ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5) Default new signups to the least-privileged role (project_manager)
-- instead of developer. Elevation to developer must be performed explicitly
-- by an admin (out-of-band) via the service role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role public.app_role;
  display_name TEXT;
BEGIN
  IF LOWER(NEW.email) = 'gloria.pm@proyecto.com' THEN
    assigned_role := 'project_manager';
    display_name := 'Gloria';
  ELSIF LOWER(NEW.email) = 'albertodev@proyecto.com' THEN
    assigned_role := 'developer';
    display_name := 'Alberto';
  ELSE
    -- Default to the least-privileged role. Admins can elevate later.
    assigned_role := 'project_manager';
    display_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  END IF;

  INSERT INTO public.profiles (id, name, email) VALUES (NEW.id, display_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
