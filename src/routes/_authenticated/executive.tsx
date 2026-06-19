import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchPhases, fetchTasks } from "@/lib/api";
import { StatusPill, ProgressBar } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertOctagon, Loader2, ChevronRight } from "lucide-react";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/executive")({
  component: ExecutiveDashboard,
});

function ExecutiveDashboard() {
  const phasesQ = useQuery({ queryKey: ["phases"], queryFn: fetchPhases });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });

  const { exec, techByExec, globalPct, blocked, doneExec } = useMemo(() => {
    const all = tasksQ.data ?? [];
    const exec = all.filter((t) => t.type === "executive");
    const tech = all.filter((t) => t.type === "technical");
    const techByExec = new Map<string, Task[]>();
    tech.forEach((t) => {
      if (!t.parent_executive_id) return;
      const arr = techByExec.get(t.parent_executive_id) ?? [];
      arr.push(t);
      techByExec.set(t.parent_executive_id, arr);
    });
    const blocked = tech.filter((t) => t.status === "bloqueado").length;
    const doneExec = exec.filter((t) => {
      const ts = techByExec.get(t.id) ?? [];
      if (ts.length === 0) return t.status === "completado";
      return ts.every((x) => x.status === "completado");
    }).length;
    const globalPct = exec.length ? Math.round((doneExec / exec.length) * 100) : 0;
    return { exec, techByExec, globalPct, blocked, doneExec };
  }, [tasksQ.data]);

  if (phasesQ.isLoading || tasksQ.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-wider text-primary mb-1">Vista ejecutiva · Gloria</div>
        <h1 className="text-2xl font-semibold tracking-tight">Avance del proyecto</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumen del estado por fases e hitos clave.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Progreso global</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold">{globalPct}%</span>
            <span className="text-xs text-muted-foreground">{doneExec}/{exec.length} hitos</span>
          </div>
          <div className="mt-3"><ProgressBar value={globalPct} /></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" /> Hitos completados
          </div>
          <div className="mt-2 text-3xl font-semibold">{doneExec}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertOctagon className="h-3.5 w-3.5 text-[color:var(--destructive)]" /> Tareas bloqueadas
          </div>
          <div className="mt-2 text-3xl font-semibold">{blocked}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(phasesQ.data ?? []).map((phase) => {
          const phaseExec = exec.filter((t) => t.phase_id === phase.id);
          const totals = phaseExec.map((t) => {
            const ts = techByExec.get(t.id) ?? [];
            const done = ts.filter((x) => x.status === "completado").length;
            const pct = ts.length ? Math.round((done / ts.length) * 100) : t.status === "completado" ? 100 : 0;
            const status = ts.length === 0 ? t.status :
              ts.some((x) => x.status === "bloqueado") ? "bloqueado" :
              ts.every((x) => x.status === "completado") ? "completado" :
              ts.some((x) => x.status === "en_curso" || x.status === "completado") ? "en_curso" : "pendiente";
            return { task: t, pct, status, done, total: ts.length };
          });
          const phasePct = totals.length ? Math.round(totals.reduce((s, x) => s + x.pct, 0) / totals.length) : 0;

          return (
            <Card key={phase.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="text-[11px] font-mono text-muted-foreground">F{phase.order_index.toString().padStart(2, "0")}</div>
                  <h2 className="text-base font-semibold">{phase.name}</h2>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium">{phasePct}%</div>
                  <div className="w-20 mt-1"><ProgressBar value={phasePct} /></div>
                </div>
              </div>

              <ul className="space-y-1">
                {totals.map((row) => (
                  <li key={row.task.id}>
                    <Link
                      to="/task/$taskId"
                      params={{ taskId: row.task.id }}
                      className="group flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/40"
                    >
                      <StatusPill status={row.status as Task["status"]} />
                      <span className="flex-1 text-sm truncate">{row.task.title}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {row.total > 0 ? `${row.done}/${row.total}` : "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
                {totals.length === 0 && (
                  <li className="text-xs text-muted-foreground px-2 py-3">Sin hitos definidos.</li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
