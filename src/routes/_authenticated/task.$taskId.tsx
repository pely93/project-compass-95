import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchTask,
  fetchComments,
  fetchAttachments,
  fetchHistory,
  fetchTasks,
  fetchProfiles,
  updateTask,
  addComment,
  addAttachment,
  uploadAttachmentFile,
  deleteTask,
} from "@/lib/api";
import { AttachmentItem } from "@/components/attachment-item";
import { useAuth } from "@/hooks/use-auth";
import { StatusPill, PriorityBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, Paperclip, History, MessageSquare, Lock, Link as LinkIcon } from "lucide-react";
import type { TaskStatus, TaskPriority } from "@/lib/types";
import { STATUS_LABEL, PRIORITY_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/task/$taskId")({
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isDev = role === "developer";

  const taskQ = useQuery({ queryKey: ["task", taskId], queryFn: () => fetchTask(taskId) });
  const commentsQ = useQuery({ queryKey: ["comments", taskId], queryFn: () => fetchComments(taskId) });
  const attachQ = useQuery({ queryKey: ["attachments", taskId], queryFn: () => fetchAttachments(taskId) });
  const historyQ = useQuery({ queryKey: ["history", taskId], queryFn: () => fetchHistory(taskId), enabled: isDev });
  const profilesQ = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const allTasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });

  const [newComment, setNewComment] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");

  if (taskQ.isLoading || !taskQ.data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const task = taskQ.data;
  const parent = task.parent_executive_id
    ? (allTasksQ.data ?? []).find((t) => t.id === task.parent_executive_id)
    : null;
  const children = (allTasksQ.data ?? []).filter((t) => t.parent_executive_id === task.id);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["history", taskId] });
  };

  const handlePatch = async (patch: Parameters<typeof updateTask>[1]) => {
    try {
      await updateTask(taskId, patch, user?.id ?? null, task);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await addComment(taskId, newComment.trim(), commentInternal, user?.id ?? null);
      setNewComment("");
      setCommentInternal(false);
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attName.trim() || !attUrl.trim()) return;
    try {
      await addAttachment(taskId, attName.trim(), attUrl.trim(), user?.id ?? null);
      setAttName("");
      setAttUrl("");
      qc.invalidateQueries({ queryKey: ["attachments", taskId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    try {
      await deleteTask(taskId);
      toast.success("Tarea eliminada");
      navigate({ to: isDev ? "/technical" : "/executive" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const profiles = profilesQ.data ?? [];

  return (
    <div className="p-8 max-w-5xl">
      <button
        onClick={() => navigate({ to: isDev ? "/technical" : "/executive" })}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Volver
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
              {task.type === "technical" ? "Técnica" : "Ejecutiva"}
            </span>
            {task.is_internal && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Interna
              </span>
            )}
          </div>
          {isDev ? (
            <Input
              value={task.title}
              onChange={(e) => void handlePatch({ title: e.target.value })}
              className="text-2xl font-semibold border-0 bg-transparent px-0 h-auto focus-visible:ring-0"
            />
          ) : (
            <h1 className="text-2xl font-semibold">{task.title}</h1>
          )}
          {parent && (
            <Link
              to="/task/$taskId"
              params={{ taskId: parent.id }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LinkIcon className="h-3 w-3" /> Parte de: {parent.title}
            </Link>
          )}
        </div>
        {isDev && (
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-5">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            {isDev ? (
              <Textarea
                value={task.description ?? ""}
                onChange={(e) => void handlePatch({ description: e.target.value })}
                placeholder="Añade detalles, pasos, contexto…"
                className="mt-2 min-h-24 bg-transparent"
              />
            ) : (
              <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/90">
                {task.description || <span className="text-muted-foreground">Sin descripción.</span>}
              </p>
            )}
          </Card>

          {children.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Tareas técnicas vinculadas ({children.length})</h3>
              <ul className="space-y-1">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/task/$taskId"
                      params={{ taskId: c.id }}
                      className="flex items-center gap-3 px-2 py-2 rounded hover:bg-accent/40"
                    >
                      <StatusPill status={c.status} />
                      <span className="flex-1 text-sm truncate">{c.title}</span>
                      <PriorityBadge priority={c.priority} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Comentarios
            </h3>
            <form onSubmit={handleAddComment} className="space-y-2 mb-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario…"
                className="bg-transparent min-h-20"
              />
              <div className="flex items-center justify-between">
                {isDev ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={commentInternal} onCheckedChange={setCommentInternal} />
                    Marcar como interno (solo Developer)
                  </label>
                ) : <span />}
                <Button type="submit" size="sm" disabled={!newComment.trim()}>Publicar</Button>
              </div>
            </form>
            <ul className="space-y-3">
              {(commentsQ.data ?? []).map((c) => {
                const author = profiles.find((p) => p.id === c.author_id);
                return (
                  <li key={c.id} className="p-3 rounded-md bg-muted/40 border border-border">
                    <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
                      <span>{author?.name ?? "—"}</span>
                      <div className="flex items-center gap-2">
                        {c.is_internal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">INTERNO</span>}
                        <span>{new Date(c.created_at).toLocaleString("es")}</span>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  </li>
                );
              })}
              {(commentsQ.data ?? []).length === 0 && (
                <li className="text-xs text-muted-foreground">Sin comentarios todavía.</li>
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Enlaces y adjuntos
            </h3>
            <form onSubmit={handleAddAttachment} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 mb-4">
              <Input placeholder="Nombre" value={attName} onChange={(e) => setAttName(e.target.value)} />
              <Input placeholder="https://…" value={attUrl} onChange={(e) => setAttUrl(e.target.value)} />
              <Button type="submit" size="sm" disabled={!attName.trim() || !attUrl.trim()}>Añadir</Button>
            </form>
            <ul className="space-y-1">
              {(attachQ.data ?? []).map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent/40 text-sm"
                  >
                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground truncate ml-auto">{a.url}</span>
                  </a>
                </li>
              ))}
              {(attachQ.data ?? []).length === 0 && (
                <li className="text-xs text-muted-foreground">Sin adjuntos.</li>
              )}
            </ul>
          </Card>

          {isDev && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <History className="h-4 w-4" /> Historial
              </h3>
              <ul className="space-y-1.5">
                {(historyQ.data ?? []).map((h) => (
                  <li key={h.id} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="font-mono">{new Date(h.created_at).toLocaleString("es")}</span>
                    <span className="text-foreground">{h.change_type}</span>
                    <span>·</span>
                    <span>{h.from_value || "—"} → {h.to_value || "—"}</span>
                  </li>
                ))}
                {(historyQ.data ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">Sin cambios registrados.</li>
                )}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={task.status} onValueChange={(v) => void handlePatch({ status: v as TaskStatus })}>
                <SelectTrigger className="mt-1.5 bg-transparent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Prioridad</Label>
              <Select value={task.priority} onValueChange={(v) => void handlePatch({ priority: v as TaskPriority })}>
                <SelectTrigger className="mt-1.5 bg-transparent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Responsable</Label>
              <Select
                value={task.assignee_id ?? "none"}
                onValueChange={(v) => void handlePatch({ assignee_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="mt-1.5 bg-transparent"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Fecha estimada</Label>
              <Input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => void handlePatch({ due_date: e.target.value || null })}
                className="mt-1.5 bg-transparent"
              />
            </div>
            {isDev && (
              <label className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Tarea interna
                </span>
                <Switch
                  checked={task.is_internal}
                  onCheckedChange={(v) => void handlePatch({ is_internal: v })}
                />
              </label>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
