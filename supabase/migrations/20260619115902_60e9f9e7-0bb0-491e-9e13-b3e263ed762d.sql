
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('developer', 'project_manager');
CREATE TYPE public.task_status AS ENUM ('pendiente', 'en_curso', 'bloqueado', 'completado');
CREATE TYPE public.task_priority AS ENUM ('baja', 'media', 'alta');
CREATE TYPE public.task_type AS ENUM ('technical', 'executive');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- TRIGGER: on new auth user -> profile + role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    assigned_role := 'developer';
    display_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  END IF;

  INSERT INTO public.profiles (id, name, email) VALUES (NEW.id, display_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PHASES
CREATE TABLE public.phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phases TO authenticated;
GRANT ALL ON public.phases TO service_role;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phases_select_auth" ON public.phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "phases_modify_auth" ON public.phases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  type public.task_type NOT NULL DEFAULT 'technical',
  parent_executive_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'pendiente',
  priority public.task_priority NOT NULL DEFAULT 'media',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  sort_index INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_phase ON public.tasks(phase_id);
CREATE INDEX idx_tasks_parent ON public.tasks(parent_executive_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Developer sees everything; PM sees executive tasks + non-internal technical tasks.
CREATE POLICY "tasks_select_by_role" ON public.tasks FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'developer')
  OR (
    public.has_role(auth.uid(), 'project_manager')
    AND (type = 'executive' OR is_internal = false)
  )
);
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_delete_auth" ON public.tasks FOR DELETE TO authenticated USING (true);

-- COMMENTS
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_task ON public.comments(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_by_role" ON public.comments FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'developer')
  OR (public.has_role(auth.uid(), 'project_manager') AND is_internal = false)
);
CREATE POLICY "comments_insert_auth" ON public.comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated USING (author_id = auth.uid());

-- ATTACHMENTS
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'link',
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_task ON public.attachments(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_select_auth" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "attachments_modify_auth" ON public.attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TASK HISTORY
CREATE TABLE public.task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_task ON public.task_history(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_history TO authenticated;
GRANT ALL ON public.task_history TO service_role;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select_auth" ON public.task_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "history_insert_auth" ON public.task_history FOR INSERT TO authenticated WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
