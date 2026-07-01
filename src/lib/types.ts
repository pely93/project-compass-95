export type AppRole = "developer" | "project_manager";
export type TaskStatus = "pendiente" | "en_curso" | "bloqueado" | "completado";
export type TaskPriority = "baja" | "media" | "alta";
export type TaskType = "technical" | "executive";
export type TaskVisibility = "interna" | "compartida" | "visible_pm";

export interface Phase {
  id: string;
  order_index: number;
  name: string;
  description: string | null;
  estimated_hours: number | null;
}

export interface Profile {
  id: string;
  name: string;
  email?: string;
}

export interface Task {
  id: string;
  phase_id: string;
  type: TaskType;
  parent_executive_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  is_internal: boolean;
  visibility: TaskVisibility;
  estimated_hours: number | null;
  actual_date: string | null;
  impacts_pm_progress: boolean;
  dependencies: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
}

export const VISIBILITY_LABEL: Record<TaskVisibility, string> = {
  interna: "INTERNA",
  compartida: "COMPARTIDA",
  visible_pm: "PM",
};

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  name: string;
  url: string;
  kind: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  task_id: string;
  actor_id: string | null;
  change_type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  bloqueado: "Bloqueado",
  completado: "Completado",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};
