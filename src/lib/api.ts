import { supabase } from "@/integrations/supabase/client";
import type { Phase, Task, Comment, Attachment, HistoryEntry, Profile, TaskStatus, TaskPriority, TaskType } from "@/lib/types";

export async function fetchPhases(): Promise<Phase[]> {
  const { data, error } = await supabase.from("phases").select("*").order("order_index");
  if (error) throw error;
  return (data ?? []) as Phase[];
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("phase_id")
    .order("type")
    .order("sort_index");
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("id,name,email");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Task | null;
}

export async function fetchComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

export async function fetchAttachments(taskId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Attachment[];
}

export async function fetchHistory(taskId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from("task_history")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HistoryEntry[];
}

export async function fetchAllHistory(limit = 200): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from("task_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as HistoryEntry[];
}

export async function updatePhase(id: string, patch: { name?: string; description?: string | null; order_index?: number }) {
  const { error } = await supabase.from("phases").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePhase(id: string) {
  const { error } = await supabase.from("phases").delete().eq("id", id);
  if (error) throw error;
}

export interface BulkTaskNode {
  title: string;
  children: BulkTaskNode[];
}

export function parseMarkdownTasks(md: string): BulkTaskNode[] {
  const lines = md.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const roots: BulkTaskNode[] = [];
  const stack: { node: BulkTaskNode; indent: number }[] = [];
  for (const raw of lines) {
    const match = raw.match(/^(\s*)[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/);
    if (!match) continue;
    const indent = match[1].replace(/\t/g, "  ").length;
    const title = match[2].trim();
    const node: BulkTaskNode = { title, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent });
  }
  return roots;
}

export async function createTasksFromMarkdown(opts: {
  md: string;
  phaseId: string;
  rootType: TaskType;
  parentExecutiveId?: string | null;
  isInternal?: boolean;
  createdBy: string | null;
}) {
  const roots = parseMarkdownTasks(opts.md);
  if (roots.length === 0) throw new Error("No se han detectado tareas en el Markdown.");

  for (const root of roots) {
    const { data: created, error } = await supabase
      .from("tasks")
      .insert({
        phase_id: opts.phaseId,
        type: opts.rootType,
        title: root.title,
        parent_executive_id: opts.rootType === "technical" ? opts.parentExecutiveId ?? null : null,
        is_internal: opts.isInternal ?? false,
        priority: "media",
        created_by: opts.createdBy,
      })
      .select("id,type")
      .single();
    if (error) throw error;

    if (root.children.length) {
      const childParent = created.type === "executive" ? created.id : opts.parentExecutiveId ?? null;
      const rows = root.children.map((c) => ({
        phase_id: opts.phaseId,
        type: "technical" as const,
        title: c.title,
        parent_executive_id: childParent,
        is_internal: opts.isInternal ?? false,
        priority: "media" as const,
        created_by: opts.createdBy,
      }));
      const { error: e2 } = await supabase.from("tasks").insert(rows);
      if (e2) throw e2;
    }
  }
  return roots.length;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  is_internal?: boolean;
}

export async function updateTask(id: string, patch: TaskUpdate, actorId: string | null, prev?: Task) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;

  if (prev) {
    const entries: { task_id: string; actor_id: string | null; change_type: string; from_value: string | null; to_value: string | null }[] = [];
    for (const key of Object.keys(patch) as (keyof TaskUpdate)[]) {
      const before = String((prev as unknown as Record<string, unknown>)[key] ?? "");
      const after = String((patch as unknown as Record<string, unknown>)[key] ?? "");
      if (before !== after) {
        entries.push({ task_id: id, actor_id: actorId, change_type: key, from_value: before, to_value: after });
      }
    }
    if (entries.length) await supabase.from("task_history").insert(entries);
  }
}

export interface NewTaskInput {
  phase_id: string;
  type: TaskType;
  title: string;
  description?: string;
  priority?: TaskPriority;
  parent_executive_id?: string | null;
  is_internal?: boolean;
  due_date?: string | null;
}

export async function createTask(input: NewTaskInput, createdBy: string | null) {
  const { error } = await supabase.from("tasks").insert({
    ...input,
    created_by: createdBy,
    priority: input.priority ?? "media",
  });
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function addComment(taskId: string, body: string, isInternal: boolean, authorId: string | null) {
  const { error } = await supabase.from("comments").insert({
    task_id: taskId,
    body,
    is_internal: isInternal,
    author_id: authorId,
  });
  if (error) throw error;
}

export async function addAttachment(taskId: string, name: string, url: string, uploadedBy: string | null) {
  const { error } = await supabase.from("attachments").insert({
    task_id: taskId,
    name,
    url,
    kind: "link",
    uploaded_by: uploadedBy,
  });
  if (error) throw error;
}

export async function createPhase(name: string, description: string | null, orderIndex: number) {
  const { error } = await supabase.from("phases").insert({ name, description, order_index: orderIndex });
  if (error) throw error;
}
