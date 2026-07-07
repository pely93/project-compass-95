
-- Fix: comments_update_own — add WITH CHECK preventing PMs from toggling is_internal
DROP POLICY IF EXISTS comments_update_own ON public.comments;
CREATE POLICY comments_update_own ON public.comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (
  author_id = auth.uid()
  AND ((is_internal = false) OR public.has_role(auth.uid(), 'developer'::public.app_role))
);

-- Fix: task-attachments SELECT — enforce access via task visibility rules
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
        OR (public.has_role(auth.uid(), 'project_manager'::public.app_role) AND t.is_internal = false)
      )
  )
);
