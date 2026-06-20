
DROP POLICY IF EXISTS phases_modify_auth ON public.phases;
CREATE POLICY phases_modify_dev ON public.phases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

DROP POLICY IF EXISTS attachments_modify_auth ON public.attachments;
CREATE POLICY attachments_insert_auth ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY attachments_update_own ON public.attachments
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY attachments_delete_own ON public.attachments
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'developer'));
