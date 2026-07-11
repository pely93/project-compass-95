import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, Trash2, Timer, Pause, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Task } from "@/lib/types";

interface TimeEntry {
  id: string;
  user_id: string;
  task_id: string | null;
  note: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  is_paused: boolean;
  paused_at: string | null;
  total_paused_seconds: number;
  is_submitted: boolean;
  submitted_at: string | null;
}

function formatHMS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function computeElapsed(e: TimeEntry, nowMs: number): number {
  const start = new Date(e.started_at).getTime();
  const end = e.ended_at ? new Date(e.ended_at).getTime() : nowMs;
  const pausedNow = e.is_paused && e.paused_at ? Math.floor((nowMs - new Date(e.paused_at).getTime()) / 1000) : 0;
  return Math.max(0, Math.floor((end - start) / 1000) - e.total_paused_seconds - pausedNow);
}

export function TimeTracker({ userId, tasks }: { userId: string; tasks: Task[] }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [taskId, setTaskId] = useState<string>("none");
  const [now, setNow] = useState(() => Date.now());

  const entriesQ = useQuery({
    queryKey: ["time_entries", userId],
    queryFn: async (): Promise<TimeEntry[]> => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
  });

  const active = useMemo(
    () => (entriesQ.data ?? []).find((e) => !e.ended_at) ?? null,
    [entriesQ.data],
  );

  useEffect(() => {
    if (!active || active.is_paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const taskMap = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) => m.set(t.id, t.title));
    return m;
  }, [tasks]);

  async function start() {
    const payload = {
      user_id: userId,
      task_id: taskId === "none" ? null : taskId,
      note: note.trim() || null,
      started_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("time_entries").insert(payload);
    if (error) return toast.error("No se pudo iniciar");
    setNote("");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  async function pause() {
    if (!active || active.is_paused) return;
    const { error } = await supabase
      .from("time_entries")
      .update({ is_paused: true, paused_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) return toast.error("No se pudo pausar");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  async function resume() {
    if (!active || !active.is_paused || !active.paused_at) return;
    const extra = Math.floor((Date.now() - new Date(active.paused_at).getTime()) / 1000);
    const { error } = await supabase
      .from("time_entries")
      .update({
        is_paused: false,
        paused_at: null,
        total_paused_seconds: active.total_paused_seconds + extra,
      })
      .eq("id", active.id);
    if (error) return toast.error("No se pudo reanudar");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  async function stop() {
    if (!active) return;
    const end = new Date();
    let extraPaused = 0;
    if (active.is_paused && active.paused_at) {
      extraPaused = Math.floor((end.getTime() - new Date(active.paused_at).getTime()) / 1000);
    }
    const totalPaused = active.total_paused_seconds + extraPaused;
    const duration = Math.max(0, Math.floor((end.getTime() - new Date(active.started_at).getTime()) / 1000) - totalPaused);
    const { error } = await supabase
      .from("time_entries")
      .update({
        ended_at: end.toISOString(),
        duration_seconds: duration,
        is_paused: false,
        paused_at: null,
        total_paused_seconds: totalPaused,
      })
      .eq("id", active.id);
    if (error) return toast.error("No se pudo detener");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  async function submitEntry(id: string) {
    const { error } = await supabase
      .from("time_entries")
      .update({ is_submitted: true, submitted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error("No se pudo enviar");
    toast.success("Enviado al PM");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) return toast.error("No se pudo borrar");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  const liveElapsed = active ? computeElapsed(active, now) : 0;

  const todayTotal = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let total = 0;
    (entriesQ.data ?? []).forEach((e) => {
      const start = new Date(e.started_at);
      if (start < today) return;
      total += e.duration_seconds ?? computeElapsed(e, now);
    });
    return total;
  }, [entriesQ.data, now]);

  return (
    <Card className="p-4 mb-4 bg-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Cronómetro personal</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">solo tú · envías al PM</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Hoy: <span className="font-mono text-foreground">{formatHMS(todayTotal)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className={`font-mono text-2xl tabular-nums px-3 py-1.5 rounded-md border ${active ? (active.is_paused ? "border-amber-500/40 bg-amber-500/5" : "border-primary/40 bg-primary/5 text-foreground") : "border-border text-muted-foreground"}`}>
          {formatHMS(liveElapsed)}
        </div>
        <Select value={taskId} onValueChange={setTaskId} disabled={!!active}>
          <SelectTrigger className="h-9 w-[220px] text-xs"><SelectValue placeholder="Tarea (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin tarea</SelectItem>
            {tasks.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="h-9 text-xs flex-1 min-w-[160px]"
          disabled={!!active}
        />
        {!active && (
          <Button size="sm" onClick={start}>
            <Play className="h-3.5 w-3.5 mr-1" /> Iniciar
          </Button>
        )}
        {active && !active.is_paused && (
          <>
            <Button size="sm" variant="outline" onClick={pause}>
              <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
            </Button>
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="h-3.5 w-3.5 mr-1" /> Detener
            </Button>
          </>
        )}
        {active && active.is_paused && (
          <>
            <Button size="sm" onClick={resume}>
              <Play className="h-3.5 w-3.5 mr-1" /> Reanudar
            </Button>
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="h-3.5 w-3.5 mr-1" /> Detener
            </Button>
          </>
        )}
      </div>

      {(entriesQ.data?.length ?? 0) > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Últimas entradas</div>
          <ul className="space-y-1 max-h-72 overflow-auto">
            {(entriesQ.data ?? []).map((e) => {
              const dur = e.duration_seconds ?? computeElapsed(e, now);
              const isRunning = !e.ended_at;
              return (
                <li key={e.id} className="flex items-center gap-3 text-xs px-2 py-1.5 rounded hover:bg-accent/40">
                  <span className={`font-mono tabular-nums w-20 ${isRunning ? (e.is_paused ? "text-amber-500" : "text-primary") : ""}`}>{formatHMS(dur)}</span>
                  <span className="flex-1 truncate">
                    {e.task_id ? (taskMap.get(e.task_id) ?? "Tarea eliminada") : <span className="text-muted-foreground">Sin tarea</span>}
                    {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                  </span>
                  {isRunning && e.is_paused && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">pausado</span>
                  )}
                  {!isRunning && e.is_submitted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> enviado
                    </span>
                  )}
                  <span className="text-muted-foreground text-[10px] hidden sm:inline">
                    {new Date(e.started_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {!isRunning && !e.is_submitted && (
                    <button
                      onClick={() => submitEntry(e.id)}
                      className="text-primary hover:text-primary/80 flex items-center gap-1"
                      title="Enviar al PM"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!isRunning && !e.is_submitted && (
                    <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
