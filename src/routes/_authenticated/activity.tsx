import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchAllHistory, fetchProfiles, fetchTasks } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Loader2, History } from "lucide-react";
import { STATUS_LABEL, PRIORITY_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
});

function formatValue(change: string, value: string | null): string {
  if (!value) return "—";
  if (change === "status") return STATUS_LABEL[value as keyof typeof STATUS_LABEL] ?? value;
  if (change === "priority") return PRIORITY_LABEL[value as keyof typeof PRIORITY_LABEL] ?? value;
  if (value.length > 60) return value.slice(0, 60) + "…";
  return value;
}

const CHANGE_LABEL: Record<string, string> = {
  status: "Estado",
  priority: "Prioridad",
  title: "Título",
  description: "Descripción",
  assignee_id: "Responsable",
  due_date: "Fecha estimada",
  is_internal: "Visibilidad",
};

function ActivityPage() {
  const histQ = useQuery({ queryKey: ["history", "all"], queryFn: () => fetchAllHistory(200) });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const profilesQ = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const taskMap = useMemo(() => {
    const m = new Map<string, string>();
    (tasksQ.data ?? []).forEach((t) => m.set(t.id, t.title));
    return m;
  }, [tasksQ.data]);
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [profilesQ.data]);

  if (histQ.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-primary mb-1 flex items-center gap-2">
          <History className="h-3.5 w-3.5" /> Actividad
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Historial de cambios</h1>
        <p className="text-sm text-muted-foreground mt-1">Últimos {histQ.data?.length ?? 0} cambios registrados.</p>
      </header>

      <Card className="divide-y divide-border">
        {(histQ.data ?? []).map((h) => {
          const change = CHANGE_LABEL[h.change_type] ?? h.change_type;
          const title = taskMap.get(h.task_id) ?? "Tarea";
          const actor = h.actor_id ? profileMap.get(h.actor_id) ?? "—" : "Sistema";
          return (
            <div key={h.id} className="px-4 py-3 text-sm flex items-start gap-3">
              <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-32">
                {new Date(h.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  <span className="font-medium">{actor}</span>{" "}
                  <span className="text-muted-foreground">cambió</span>{" "}
                  <span className="text-primary">{change}</span>{" "}
                  <span className="text-muted-foreground">en</span>{" "}
                  <span className="font-medium">{title}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  <span className="line-through">{formatValue(h.change_type, h.from_value)}</span>{" → "}
                  <span className="text-foreground">{formatValue(h.change_type, h.to_value)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {(histQ.data ?? []).length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">Sin actividad todavía.</div>
        )}
      </Card>
    </div>
  );
}
