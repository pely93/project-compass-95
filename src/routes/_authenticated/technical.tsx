import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchPhases, fetchTasks } from "@/lib/api";
import { StatusPill, PriorityBadge, ProgressBar } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Eye, EyeOff, ChevronRight, Loader2 } from "lucide-react";
import { NewTaskDialog } from "@/components/new-task-dialog";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/technical")({
  component: TechnicalDashboard,
});

function TechnicalDashboard() {
  const phasesQ = useQuery({ queryKey: ["phases"], queryFn: fetchPhases });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const [openDialog, setOpenDialog] = useState<{ phaseId: string } | null>(null);
  const [showInternal, setShowInternal] = useState(true);

  const tasksByPhase = useMemo(() => {
    const map = new Map<string, Task[]>();
    (tasksQ.data ?? []).forEach((t) => {
      if (t.type !== "technical") return;
      if (!showInternal && t.is_internal) return;
      const arr = map.get(t.phase_id) ?? [];
      arr.push(t);
      map.set(t.phase_id, arr);
    });
    return map;
  }, [tasksQ.data, showInternal]);

  const allTechnical = (tasksQ.data ?? []).filter((t) => t.type === "technical");
  const completed = allTechnical.filter((t) => t.status === "completado").length;
  const globalProgress = allTechnical.length ? Math.round((completed / allTechnical.length) * 100) : 0;

  if (phasesQ.isLoading || tasksQ.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary mb-1">Vista técnica · Alberto</div>
            <h1 className="text-2xl font-semibold tracking-tight">Checklist técnico</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allTechnical.length} tareas · {completed} completadas · {globalProgress}% global
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowInternal((v) => !v)}>
            {showInternal ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showInternal ? "Ocultar internas" : "Mostrar internas"}
          </Button>
        </div>
        <div className="mt-4 max-w-md">
          <ProgressBar value={globalProgress} />
        </div>
      </header>

      <div className="space-y-4">
        {(phasesQ.data ?? []).map((phase) => {
          const items = tasksByPhase.get(phase.id) ?? [];
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
                  <li key={t.id}>
                    <Link
                      to="/task/$taskId"
                      params={{ taskId: t.id }}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/40 transition-colors"
                    >
                      <StatusPill status={t.status} />
                      <span className="flex-1 text-sm truncate">{t.title}</span>
                      {t.is_internal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          INTERNA
                        </span>
                      )}
                      <PriorityBadge priority={t.priority} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="text-xs text-muted-foreground px-3 py-3">Sin tareas técnicas todavía.</li>
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
    </div>
  );
}

