
CREATE POLICY "task_attachments_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND owner = auth.uid());

CREATE POLICY "task_attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'developer'::app_role)));
