
ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

-- Tighten SELECT on project_documents: owner OR shared
DROP POLICY IF EXISTS "Auth users can view project documents" ON public.project_documents;
CREATE POLICY "View own or shared project documents"
ON public.project_documents
FOR SELECT
TO authenticated
USING (auth.uid() = uploaded_by OR is_shared = true);

-- Ensure INSERT policy keeps owner = auth.uid()
DROP POLICY IF EXISTS "Auth users can insert project documents" ON public.project_documents;
CREATE POLICY "Insert own project documents"
ON public.project_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

-- Storage: replace bucket-wide SELECT with owner-or-shared join
DROP POLICY IF EXISTS "Auth read project docs" ON storage.objects;
CREATE POLICY "Read own or shared project docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-docs'
  AND EXISTS (
    SELECT 1 FROM public.project_documents d
    WHERE d.storage_path = storage.objects.name
      AND (d.uploaded_by = auth.uid() OR d.is_shared = true)
  )
);

-- Keep INSERT/DELETE storage rules as owner-only (already exist), ensure they scope to owner
DROP POLICY IF EXISTS "Auth upload project docs" ON storage.objects;
CREATE POLICY "Owner upload project docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-docs' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Owner delete project docs" ON storage.objects;
CREATE POLICY "Owner delete project docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'project-docs' AND auth.uid() = owner);
