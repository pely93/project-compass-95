CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS attachments_delete_own ON public.attachments;
CREATE POLICY attachments_delete_own ON public.attachments
FOR DELETE TO authenticated
USING ((uploaded_by = auth.uid()) OR private.has_role(auth.uid(), 'developer'::public.app_role));

DROP POLICY IF EXISTS attachments_select_by_task_access ON public.attachments;
CREATE POLICY attachments_select_by_task_access ON public.attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = attachments.task_id
        AND (
          private.has_role(auth.uid(), 'developer'::public.app_role)
          OR (
            private.has_role(auth.uid(), 'project_manager'::public.app_role)
            AND (t.type = 'executive'::public.task_type OR t.is_internal = false)
          )
        )
    )
  );

DROP POLICY IF EXISTS comments_insert_by_role ON public.comments;
CREATE POLICY comments_insert_by_role ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND ((is_internal = false) OR private.has_role(auth.uid(), 'developer'::public.app_role))
);

DROP POLICY IF EXISTS comments_select_by_role ON public.comments;
CREATE POLICY comments_select_by_role ON public.comments
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'developer'::public.app_role)
  OR (private.has_role(auth.uid(), 'project_manager'::public.app_role) AND is_internal = false)
);

DROP POLICY IF EXISTS comments_update_own ON public.comments;
CREATE POLICY comments_update_own ON public.comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (
  author_id = auth.uid()
  AND ((is_internal = false) OR private.has_role(auth.uid(), 'developer'::public.app_role))
);

DROP POLICY IF EXISTS phases_modify_dev ON public.phases;
CREATE POLICY phases_modify_dev ON public.phases
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'developer'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'developer'::public.app_role));

DROP POLICY IF EXISTS history_select_by_task_access ON public.task_history;
CREATE POLICY history_select_by_task_access ON public.task_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_history.task_id
        AND (
          private.has_role(auth.uid(), 'developer'::public.app_role)
          OR (
            private.has_role(auth.uid(), 'project_manager'::public.app_role)
            AND (t.type = 'executive'::public.task_type OR t.is_internal = false)
          )
        )
    )
  );

DROP POLICY IF EXISTS tasks_delete_by_role ON public.tasks;
CREATE POLICY tasks_delete_by_role ON public.tasks
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'developer'::public.app_role));

DROP POLICY IF EXISTS tasks_insert_by_role ON public.tasks;
CREATE POLICY tasks_insert_by_role ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'developer'::public.app_role)
  OR (
    private.has_role(auth.uid(), 'project_manager'::public.app_role)
    AND type = 'executive'::public.task_type
    AND is_internal = false
  )
);

DROP POLICY IF EXISTS tasks_select_by_role ON public.tasks;
CREATE POLICY tasks_select_by_role ON public.tasks
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'developer'::public.app_role)
  OR (
    private.has_role(auth.uid(), 'project_manager'::public.app_role)
    AND (type = 'executive'::public.task_type OR is_internal = false)
  )
);

DROP POLICY IF EXISTS tasks_update_by_role ON public.tasks;
CREATE POLICY tasks_update_by_role ON public.tasks
FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'developer'::public.app_role)
  OR (
    private.has_role(auth.uid(), 'project_manager'::public.app_role)
    AND type = 'executive'::public.task_type
    AND is_internal = false
  )
)
WITH CHECK (
  private.has_role(auth.uid(), 'developer'::public.app_role)
  OR (
    private.has_role(auth.uid(), 'project_manager'::public.app_role)
    AND type = 'executive'::public.task_type
    AND is_internal = false
  )
);

DROP POLICY IF EXISTS "PM can view submitted time entries" ON public.time_entries;
CREATE POLICY "PM can view submitted time entries" ON public.time_entries
FOR SELECT TO authenticated
USING (
  is_submitted = true
  AND private.has_role(auth.uid(), 'project_manager'::public.app_role)
);

DROP POLICY IF EXISTS task_attachments_delete_own ON storage.objects;
CREATE POLICY task_attachments_delete_own ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND ((owner = auth.uid()) OR private.has_role(auth.uid(), 'developer'::public.app_role))
);

DROP POLICY IF EXISTS task_attachments_select_auth ON storage.objects;
CREATE POLICY task_attachments_select_auth ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.attachments a
    JOIN public.tasks t ON t.id = a.task_id
    WHERE a.url = storage.objects.name
      AND (
        private.has_role(auth.uid(), 'developer'::public.app_role)
        OR (
          private.has_role(auth.uid(), 'project_manager'::public.app_role)
          AND (t.type = 'executive'::public.task_type OR t.is_internal = false)
        )
      )
  )
);

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);