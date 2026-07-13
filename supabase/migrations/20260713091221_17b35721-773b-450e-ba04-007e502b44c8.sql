CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS attachments_select_by_task_access ON public.attachments;
CREATE POLICY attachments_select_by_task_access ON public.attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
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

DROP POLICY IF EXISTS history_select_by_task_access ON public.task_history;
CREATE POLICY history_select_by_task_access ON public.task_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
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
        public.has_role(auth.uid(), 'developer'::public.app_role)
        OR (
          public.has_role(auth.uid(), 'project_manager'::public.app_role)
          AND (t.type = 'executive'::public.task_type OR t.is_internal = false)
        )
      )
  )
);