import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchPhases, fetchTasks, fetchProfiles, updateTask } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { StatusPill, PriorityBadge, ProgressBar } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertOctagon, Loader2, ChevronRight, Mail, PlayCircle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import type { Task, Profile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/executive")({
  component: ExecutiveDashboard,
});

function ExecutiveDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const phasesQ = useQuery({ queryKey: ["phases"], queryFn: fetchPhases });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const profilesQ = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const profileById = useMemo(
    () => new Map<string, Profile>((profilesQ.data ?? []).map((p) => [p.id, p])),
    [profilesQ.data],
  );

  const assigneeOptions = useMemo(() => {
    const profiles = profilesQ.data ?? [];
    return [
      { value: "all", label: "Cualquier responsable" },
      { value: "unassigned", label: "Sin asignar" },
      ...profiles.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    ];
  }, [profilesQ.data]);

  const { byPhase, totalCount, doneCount, globalPct, blockedTasks } = useMemo(() => {
    let visibleTasks = (tasksQ.data ?? []).filter(
      (t) => t.type === "technical" && t.visibility !== "interna",
    );

    if (assigneeFilter === "unassigned") {
      visibleTasks = visibleTasks.filter((t) => !t.assignee_id);
    } else if (assigneeFilter !== "all") {
      visibleTasks = visibleTasks.filter((t) => t.assignee_id === assigneeFilter);
    }

    const byPhase = new Map<string, Task[]>();
    visibleTasks.forEach((t) => {
      const arr = byPhase.get(t.phase_id) ?? [];
      arr.push(t);
      byPhase.set(t.phase_id, arr);
    });

    const totalCount = visibleTasks.length;
    const doneCount = visibleTasks.filter((t) => t.status === "completado").length;
    const globalPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
    const blockedTasks = visibleTasks.filter((t) => t.status === "bloqueado");

    return { byPhase, totalCount, doneCount, globalPct, blockedTasks };
  }, [tasksQ.data, assigneeFilter]);

  const unblock = async (task: Task) => {
    try {
      await updateTask(task.id, { status: "en_curso" }, user?.id ?? null, task);
      toast.success("Tarea marcada como en curso");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const notify = (task: Task) => {
    const assignee = task.assignee_id ? profileById.get(task.assignee_id) : null;
    if (!assignee?.email) {
      toast.error("La tarea no tiene responsable con email.");
      return;
    }
    const url = `${window.location.origin}/task/${task.id}`;
    const subject = encodeURIComponent(`[Bloqueada] ${task.title}`);
    const body = encodeURIComponent(
      `Hola ${assignee.name ?? ""},\n\nLa tarea "${task.title}" está marcada como bloqueada.\n¿Puedes revisarla?\n\n${url}\n\nGracias.`,
    );
    window.location.href = `mailto:${assignee.email}?subject=${subject}&body=${body}`;
  };

  if (phasesQ.isLoading || tasksQ.isLoading || profilesQ.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-wider text-primary mb-1">Vista ejecutiva · Gloria</div>
        <h1 className="text-2xl font-semibold tracking-tight">Avance del proyecto</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mismo checklist que el panel técnico, sin las tareas marcadas como internas.
        </p>
      </header>

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
          <div className="text-xs text-muted-foreground shrink-0">Filtros</div>

          <div className="w-full sm:w-[240px]">
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquier responsable" />
              </SelectTrigger>
              <SelectContent>
                {assigneeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assigneeFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAssigneeFilter("all")}
              className="justify-start sm:justify-center"
            >
              <X className="h-4 w-4 mr-1.5" />
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Progreso global</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold">{globalPct}%</span>
            <span className="text-xs text-muted-foreground">{doneCount}/{totalCount} tareas</span>
          </div>
          <div className="mt-3"><ProgressBar value={globalPct} /></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" /> Tareas completadas
          </div>
          <div className="mt-2 text-3xl font-semibold">{doneCount}</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertOctagon className="h-3.5 w-3.5 text-[color:var(--destructive)]" /> Tareas bloqueadas
          </div>
          <div className="mt-2 text-3xl font-semibold">{blockedTasks.length}</div>
        </Card>
      </div>

      {blockedTasks.length > 0 && (
        <Card className="p-5 mb-8 border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon className="h-4 w-4 text-[color:var(--destructive)]" />
            <h2 className="text-sm font-semibold">Alertas · Tareas bloqueadas</h2>
            <span className="text-xs text-muted-foreground">({blockedTasks.length})</span>
          </div>

          <ul className="divide-y divide-border/60">
            {blockedTasks.map((t) => {
              const assignee = t.assignee_id ? profileById.get(t.assignee_id) : null;
              const phase = (phasesQ.data ?? []).find((p) => p.id === t.phase_id);

              return (
                <li key={t.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {phase?.name ?? "Sin fase"} · {assignee?.name ?? "Sin responsable"}
                      {t.due_date ? ` · vence ${t.due_date}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => notify(t)} disabled={!assignee?.email}>
                      <Mail className="h-3.5 w-3.5 mr-1.5" /> Avisar
                    </Button>

                    <Button size="sm" variant="outline" onClick={() => unblock(t)}>
                      <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Desbloquear
                    </Button>

                    <Link
                      to="/task/$taskId"
                      params={{ taskId: t.id }}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline px-2"
                    >
                      Abrir <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="space-y-4">
        {(phasesQ.data ?? []).map((phase) => {
          const items = byPhase.get(phase.id) ?? [];
          const done = items.filter((t) => t.status === "completado").length;
          const pct = items.length ? Math.round((done / items.length) * 100) : 0;

          return (
            <Card key={phase.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    F{phase.order_index.toString().padStart(2, "0")}
                  </div>
                  <h2 className="text-base font-semibold">{phase.name}</h2>
                  {phase.estimated_hours != null && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      ~{phase.estimated_hours}h estimadas
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-medium">{done}/{items.length}</div>
                  <div className="w-20 mt-1"><ProgressBar value={pct} /></div>
                </div>
              </div>

              <ul className="space-y-1">
                {items.map((t) => (
                 <li key={t.id}>
  <Link
    to="/task/$taskId"
    params={{ taskId: t.id }}
    className="group flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/40"
  >
    <StatusPill status={t.status} />
    <span className="flex-1 text-sm truncate">{t.title}</span>
    <PriorityBadge priority={t.priority} />
    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
  </Link>
</li>

                ))}

                {items.length === 0 && (
                  <li className="text-xs text-muted-foreground px-2 py-3">
                    Sin tareas visibles en esta fase.
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
