
DROP POLICY IF EXISTS attachments_select_by_task_access ON public.attachments;
CREATE POLICY attachments_select_by_task_access ON public.attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = attachments.task_id
    AND (
      public.has_role(auth.uid(), 'developer'::public.app_role)
      OR (public.has_role(auth.uid(), 'project_manager'::public.app_role) AND t.is_internal = false)
    )
));

DROP POLICY IF EXISTS history_select_by_task_access ON public.task_history;
CREATE POLICY history_select_by_task_access ON public.task_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_history.task_id
    AND (
      public.has_role(auth.uid(), 'developer'::public.app_role)
      OR (public.has_role(auth.uid(), 'project_manager'::public.app_role) AND t.is_internal = false)
    )
));
