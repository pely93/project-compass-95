
CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('contrato','anexo','factura','otro')),
  name TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_documents TO authenticated;
GRANT ALL ON public.project_documents TO service_role;

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view project documents"
  ON public.project_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Auth users can insert project documents"
  ON public.project_documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can update own document"
  ON public.project_documents FOR UPDATE
  TO authenticated USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can delete own document"
  ON public.project_documents FOR DELETE
  TO authenticated USING (auth.uid() = uploaded_by);

CREATE TRIGGER trg_project_documents_updated_at
  BEFORE UPDATE ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_project_documents_created ON public.project_documents(created_at DESC);

-- Storage policies for a shared bucket 'project-docs' (bucket will be created via tool)
CREATE POLICY "Auth read project docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-docs');

CREATE POLICY "Auth upload project docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-docs' AND auth.uid() = owner);

CREATE POLICY "Owner delete project docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-docs' AND auth.uid() = owner);
