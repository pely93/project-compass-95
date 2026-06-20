
-- Tasks: tighten INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS tasks_insert_auth ON public.tasks;
DROP POLICY IF EXISTS tasks_update_auth ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_auth ON public.tasks;

CREATE POLICY tasks_insert_by_role ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'developer')
    OR (
      public.has_role(auth.uid(), 'project_manager')
      AND type = 'executive'
      AND is_internal = false
    )
  );

CREATE POLICY tasks_update_by_role ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'developer')
    OR (
      public.has_role(auth.uid(), 'project_manager')
      AND type = 'executive'
      AND is_internal = false
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'developer')
    OR (
      public.has_role(auth.uid(), 'project_manager')
      AND type = 'executive'
      AND is_internal = false
    )
  );

CREATE POLICY tasks_delete_by_role ON public.tasks
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

-- Comments: restrict is_internal=true to developers
DROP POLICY IF EXISTS comments_insert_auth ON public.comments;

CREATE POLICY comments_insert_by_role ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      is_internal = false
      OR public.has_role(auth.uid(), 'developer')
    )
  );

-- Task history: actor must be the caller
DROP POLICY IF EXISTS history_insert_auth ON public.task_history;

CREATE POLICY history_insert_self ON public.task_history
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Profiles: hide email column from other users
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;

CREATE POLICY profiles_select_basic ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, name, created_at) ON public.profiles TO authenticated;
GRANT SELECT (id, name, email, created_at) ON public.profiles TO service_role;

-- Allow user to read their own email via a dedicated grant policy is unnecessary;
-- the email is available from auth.users via the session.

-- Lock down SECURITY DEFINER functions: trigger-only functions should not be exposed via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role must remain executable by authenticated because RLS policies invoke it
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
