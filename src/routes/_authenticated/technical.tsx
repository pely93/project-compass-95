import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { bulkUpdateVisibility, fetchPhases, fetchProfiles, fetchTasks } from "@/lib/api";
import { StatusPill, PriorityBadge, ProgressBar, VisibilityBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, EyeOff, ChevronRight, Loader2, FileCode, X, Lock, Users } from "lucide-react";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { MarkdownImportDialog } from "@/components/markdown-import-dialog";
import { TimeTracker } from "@/components/time-tracker";
import { useAuth } from "@/hooks/use-auth";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Task, TaskStatus, TaskPriority } from "@/lib/types";
import { STATUS_LABEL, PRIORITY_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/technical")({
  component: TechnicalDashboard,
});

function TechnicalDashboard() {
  const { user, role } = useAuth();
  const phasesQ = useQuery({ queryKey: ["phases"], queryFn: fetchPhases });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const profilesQ = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const [openDialog, setOpenDialog] = useState<{ phaseId: string } | null>(null);
  const [openImport, setOpenImport] = useState(false);
  const [showInternal, setShowInternal] = useState(true);
  const [fStatus, setFStatus] = useState<TaskStatus | "all">("all");
  const [fPriority, setFPriority] = useState<TaskPriority | "all">("all");
  const [fAssignee, setFAssignee] = useState<string>("all");
  const [fPhase, setFPhase] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const qc = useQueryClient();

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const applyBulkVisibility = async (v: "interna" | "compartida") => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateVisibility(Array.from(selected), v);
      toast.success(`${selected.size} tareas actualizadas`);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setBulkBusy(false);
    }
  };

  const filtersActive = fStatus !== "all" || fPriority !== "all" || fAssignee !== "all" || fPhase !== "all";

  const tasksByPhase = useMemo(() => {
    const map = new Map<string, Task[]>();
    (tasksQ.data ?? []).forEach((t) => {
      if (t.type !== "technical") return;
      if (!showInternal && t.is_internal) return;
      if (fStatus !== "all" && t.status !== fStatus) return;
      if (fPriority !== "all" && t.priority !== fPriority) return;
      if (fAssignee !== "all" && t.assignee_id !== fAssignee) return;
      if (fPhase !== "all" && t.phase_id !== fPhase) return;
      const arr = map.get(t.phase_id) ?? [];
      arr.push(t);
      map.set(t.phase_id, arr);
    });
    return map;
  }, [tasksQ.data, showInternal, fStatus, fPriority, fAssignee, fPhase]);

  const allTechnical = (tasksQ.data ?? []).filter((t) => t.type === "technical");
  const completed = allTechnical.filter((t) => t.status === "completado").length;
  const globalProgress = allTechnical.length ? Math.round((completed / allTechnical.length) * 100) : 0;
  const visiblePhases = (phasesQ.data ?? []).filter((p) => fPhase === "all" || p.id === fPhase);

  if (phasesQ.isLoading || tasksQ.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl">
      <header className="mb-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary mb-1">Vista técnica · Alberto</div>
            <h1 className="text-2xl font-semibold tracking-tight">Checklist técnico</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allTechnical.length} tareas · {completed} completadas · {globalProgress}% global
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenImport(true)}>
              <FileCode className="h-4 w-4 mr-2" /> Importar Markdown
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowInternal((v) => !v)}>
              {showInternal ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              {showInternal ? "Ocultar internas" : "Mostrar internas"}
            </Button>
          </div>
        </div>
        <div className="mt-4 max-w-md">
          <ProgressBar value={globalProgress} />
        </div>
      </header>

      {user && role === "developer" && (
        <TimeTracker userId={user.id} tasks={allTechnical} />
      )}

      <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground px-2">Filtros</span>
        <Select value={fPhase} onValueChange={setFPhase}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fases</SelectItem>
            {(phasesQ.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>F{p.order_index.toString().padStart(2,"0")} · {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={(v) => setFStatus(v as TaskStatus | "all")}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier estado</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPriority} onValueChange={(v) => setFPriority(v as TaskPriority | "all")}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier prioridad</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fAssignee} onValueChange={setFAssignee}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier responsable</SelectItem>
            {(profilesQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setFStatus("all"); setFPriority("all"); setFAssignee("all"); setFPhase("all"); }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </Card>

      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-background/95 backdrop-blur p-3 shadow-md">
          <span className="text-xs font-medium px-1">
            {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => applyBulkVisibility("interna")}>
            <Lock className="h-3.5 w-3.5 mr-1" /> Marcar como interna
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => applyBulkVisibility("compartida")}>
            <Users className="h-3.5 w-3.5 mr-1" /> Marcar como compartida
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar selección
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {visiblePhases.map((phase) => {
          const items = tasksByPhase.get(phase.id) ?? [];
          const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));
          const someSelected = items.some((t) => selected.has(t.id));
          const toggleAllInPhase = () => {
            setSelected((prev) => {
              const next = new Set(prev);
              if (allSelected) items.forEach((t) => next.delete(t.id));
              else items.forEach((t) => next.add(t.id));
              return next;
            });
          };
          const done = items.filter((t) => t.status === "completado").length;
          const pct = items.length ? Math.round((done / items.length) * 100) : 0;
          return (
            <Card key={phase.id} className="p-5 bg-card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      F{phase.order_index.toString().padStart(2, "0")}
                    </span>
                    <h2 className="text-base font-semibold">{phase.name}</h2>
                    {phase.estimated_hours != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                        ~{phase.estimated_hours}h
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{phase.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">{done}/{items.length}</div>
                  <div className="w-24 mt-1"><ProgressBar value={pct} /></div>
                </div>
              </div>

              <ul className="space-y-1">
                {items.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={() => toggleSelected(t.id)}
                      aria-label="Seleccionar tarea"
                      className="ml-2"
                    />
                    <Link
                      to="/task/$taskId"
                      params={{ taskId: t.id }}
                      className="group flex flex-1 items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/40 transition-colors min-w-0"
                    >
                      <StatusPill status={t.status} />
                      <span className="flex-1 text-sm truncate">{t.title}</span>
                      <VisibilityBadge visibility={t.visibility} />
                      {t.estimated_hours != null && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          ~{t.estimated_hours}h
                        </span>
                      )}
                      <PriorityBadge priority={t.priority} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="text-xs text-muted-foreground px-3 py-3">
                    {filtersActive ? "Ninguna tarea coincide con los filtros." : "Sin tareas técnicas todavía."}
                  </li>
                )}
              </ul>

              <div className="mt-3 pt-3 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => setOpenDialog({ phaseId: phase.id })}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Añadir tarea técnica
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {openDialog && (
        <NewTaskDialog
          phaseId={openDialog.phaseId}
          defaultType="technical"
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openImport && <MarkdownImportDialog onClose={() => setOpenImport(false)} defaultType="technical" />}
    </div>
  );
}
