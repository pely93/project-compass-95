import { supabase } from "@/integrations/supabase/client";
import type { Phase, Task, Comment, Attachment, HistoryEntry, Profile, TaskStatus, TaskPriority, TaskType, TaskVisibility } from "@/lib/types";

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
  const lines = md.split(/\r?\n/).filter((l) => l.trim().length > 0 && !/^#{1,6}\s/.test(l));
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

export interface BulkSection {
  phaseHint?: string;
  type: TaskType;
  isInternal: boolean;
  roots: BulkTaskNode[];
}

export function parseMarkdownDoc(md: string): BulkSection[] {
  const lines = md.split(/\r?\n/);
  const sections: BulkSection[] = [];
  let current: BulkSection | null = null;
  let stack: { node: BulkTaskNode; indent: number }[] = [];
  const ensure = (): BulkSection => {
    if (!current) {
      current = { type: "technical", isInternal: false, roots: [] };
      sections.push(current);
      stack = [];
    }
    return current;
  };
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const h = raw.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const text = h[2].trim();
      const faseM = text.match(/^fase\s*[:\-]?\s*(.+)$/i);
      const typeM = text.match(/^(t[ée]cnicas?|ejecutivas?|hitos?)$/i);
      const intM = /interna/i.test(text);
      if (faseM) {
        current = { phaseHint: faseM[1].trim(), type: "technical", isInternal: intM, roots: [] };
        sections.push(current);
        stack = [];
      } else if (typeM) {
        const s = ensure();
        s.type = /ejecutiva|hito/i.test(typeM[1]) ? "executive" : "technical";
        if (intM) s.isInternal = true;
        stack = [];
      } else if (intM) {
        ensure().isInternal = true;
        stack = [];
      }
      continue;
    }
    const m = raw.match(/^(\s*)[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/);
    if (!m) continue;
    const s = ensure();
    const indent = m[1].replace(/\t/g, "  ").length;
    const node: BulkTaskNode = { title: m[2].trim(), children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length === 0) s.roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent });
  }
  return sections.filter((s) => s.roots.length > 0);
}

function resolvePhaseId(hint: string | undefined, phases: Phase[], fallbackId: string): string {
  if (!hint) return fallbackId;
  const norm = hint.toLowerCase().trim();
  const fMatch = norm.match(/^f?0*(\d+)\b/);
  if (fMatch) {
    const idx = Number(fMatch[1]);
    const byIdx = phases.find((p) => p.order_index === idx);
    if (byIdx) return byIdx.id;
  }
  const byName = phases.find((p) => norm.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(norm));
  return byName?.id ?? fallbackId;
}

export async function createTasksFromMarkdown(opts: {
  md: string;
  phaseId: string;
  rootType: TaskType;
  parentExecutiveId?: string | null;
  isInternal?: boolean;
  createdBy: string | null;
  phases?: Phase[];
}) {
  const sections = parseMarkdownDoc(opts.md);
  if (sections.length === 0) throw new Error("No se han detectado tareas en el Markdown.");
  const phases = opts.phases ?? (await fetchPhases());

  let total = 0;
  for (const section of sections) {
    const hasHint = Boolean(section.phaseHint);
    const phaseId = resolvePhaseId(section.phaseHint, phases, opts.phaseId);
    const type = hasHint ? section.type : opts.rootType;
    const isInternal = hasHint ? section.isInternal : (opts.isInternal ?? false);
    const parentExec = type === "technical" && !hasHint ? opts.parentExecutiveId ?? null : null;

    for (const root of section.roots) {
      const { data: created, error } = await supabase
        .from("tasks")
        .insert({
          phase_id: phaseId,
          type,
          title: root.title,
          parent_executive_id: parentExec,
          is_internal: isInternal,
          priority: "media",
          created_by: opts.createdBy,
        })
        .select("id,type")
        .single();
      if (error) throw error;
      total += 1;

      if (root.children.length) {
        const childParent = created.type === "executive" ? created.id : parentExec;
        const rows = root.children.map((c) => ({
          phase_id: phaseId,
          type: "technical" as const,
          title: c.title,
          parent_executive_id: childParent,
          is_internal: isInternal,
          priority: "media" as const,
          created_by: opts.createdBy,
        }));
        const { error: e2 } = await supabase.from("tasks").insert(rows);
        if (e2) throw e2;
        total += rows.length;
      }
    }
  }
  return total;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  actual_date?: string | null;
  estimated_hours?: number | null;
  visibility?: TaskVisibility;
  impacts_pm_progress?: boolean;
  dependencies?: string | null;
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
  visibility?: TaskVisibility;
  estimated_hours?: number | null;
  due_date?: string | null;
  is_internal?: boolean;
}

export async function createTask(input: NewTaskInput, createdBy: string | null) {
  const { error } = await supabase.from("tasks").insert({
    ...input,
    created_by: createdBy,
    priority: input.priority ?? "media",
  });
  if (error) throw error;
}

export async function bulkUpdateVisibility(ids: string[], visibility: TaskVisibility) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("tasks").update({ visibility }).in("id", ids);
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

export const ATTACHMENT_BUCKET = "task-attachments";

export async function uploadAttachmentFile(taskId: string, file: File, uploadedBy: string | null) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${taskId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;
  const kind = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "file";
  const { error } = await supabase.from("attachments").insert({
    task_id: taskId,
    name: file.name,
    url: path,
    kind,
    uploaded_by: uploadedBy,
  });
  if (error) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
    throw error;
  }
}

export async function getAttachmentSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(id: string, path: string | null, kind: string) {
  if (kind !== "link" && path) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
  }
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) throw error;
}

export async function createPhase(name: string, description: string | null, orderIndex: number) {
  const { error } = await supabase.from("phases").insert({ name, description, order_index: orderIndex });
  if (error) throw error;
}
