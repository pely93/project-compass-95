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
  const { data, error } = await supabase.from("profiles").select("id,name");
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
