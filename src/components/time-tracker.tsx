import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, Trash2, Timer, Pause } from "lucide-react";
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
}

function formatHMS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function TimeTracker({ userId, tasks }: { userId: string; tasks: Task[] }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [taskId, setTaskId] = useState<string>("none");
  const [now, setNow] = useState(() => Date.now());

  const [paused, setPaused] = useState(false);
  const [pausedSeconds, setPausedSeconds] = useState(0);

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

  const running = useMemo(
    () => (entriesQ.data ?? []).find((e) => !e.ended_at) ?? null,
    [entriesQ.data],
  );

  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, paused]);

  useEffect(() => {
    if (!running) {
      setPaused(false);
      setPausedSeconds(0);
    }
  }, [running]);

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

    setNow(Date.now());
    setPaused(false);
    setPausedSeconds(0);
    setNote("");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  function pause() {
    if (!running || paused) return;
    const elapsed = Math.floor((Date.now() - new Date(running.started_at).getTime()) / 1000);
    setPausedSeconds(elapsed);
    setPaused(true);
  }

  function resume() {
    if (!running || !paused) return;
    const adjustedStartedAt = new Date(Date.now() - pausedSeconds * 1000).toISOString();

    supabase
      .from("time_entries")
      .update({ started_at: adjustedStartedAt })
      .eq("id", running.id)
      .then(({ error }) => {
        if (error) {
          toast.error("No se pudo reanudar");
          return;
        }
        setNow(Date.now());
        setPaused(false);
        qc.invalidateQueries({ queryKey: ["time_entries", userId] });
      });
  }

  async function stop() {
    if (!running) return;

    const end = new Date();
    const duration = paused
      ? pausedSeconds
      : Math.floor((end.getTime() - new Date(running.started_at).getTime()) / 1000);

    const { error } = await supabase
      .from("time_entries")
      .update({ ended_at: end.toISOString(), duration_seconds: duration })
      .eq("id", running.id);

    if (error) return toast.error("No se pudo detener");

    setPaused(false);
    setPausedSeconds(0);
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) return toast.error("No se pudo borrar");
    qc.invalidateQueries({ queryKey: ["time_entries", userId] });
  }

  const liveElapsed = running
    ? paused
      ? pausedSeconds
      : Math.floor((now - new Date(running.started_at).getTime()) / 1000)
    : 0;

  const todayTotal = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;
    (entriesQ.data ?? []).forEach((e) => {
      const start = new Date(e.started_at);
      if (start < today) return;

      if (e.duration_seconds != null) {
        total += e.duration_seconds;
      } else if (!e.ended_at && running?.id === e.id) {
        total += liveElapsed;
      }
    });

    return total;
  }, [entriesQ.data, liveElapsed, running?.id]);

  return (
    <Card className="p-4 mb-4 bg-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Cronómetro personal</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">solo tú</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Hoy: <span className="font-mono text-foreground">{formatHMS(todayTotal)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className={`font-mono text-2xl tabular-nums px-3 py-1.5 rounded-md border ${
            running
              ? paused
                ? "border-yellow-500/40 bg-yellow-500/5 text-foreground"
                : "border-primary/40 bg-primary/5 text-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          {formatHMS(liveElapsed)}
        </div>

        <Select value={taskId} onValueChange={setTaskId} disabled={!!running}>
          <SelectTrigger className="h-9 w-[220px] text-xs">
            <SelectValue placeholder="Tarea (opcional)" />
          </SelectTrigger>
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
          disabled={!!running}
        />

        {!running ? (
          <Button size="sm" onClick={start}>
            <Play className="h-3.5 w-3.5 mr-1" /> Iniciar
          </Button>
        ) : paused ? (
          <>
            <Button size="sm" onClick={resume}>
              <Play className="h-3.5 w-3.5 mr-1" /> Reanudar
            </Button>
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="h-3.5 w-3.5 mr-1" /> Detener
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={pause}>
              <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
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
          <ul className="space-y-1 max-h-60 overflow-auto">
            {(entriesQ.data ?? []).map((e) => {
              const isRunning = !e.ended_at;
              const dur =
                e.duration_seconds ??
                (running?.id === e.id ? liveElapsed : 0);

              return (
                <li key={e.id} className="flex items-center gap-3 text-xs px-2 py-1.5 rounded hover:bg-accent/40">
                  <span className={`font-mono tabular-nums w-20 ${isRunning ? "text-primary" : ""}`}>
                    {formatHMS(dur)}
                  </span>

                  <span className="flex-1 truncate">
                    {e.task_id
                      ? (taskMap.get(e.task_id) ?? "Tarea eliminada")
                      : <span className="text-muted-foreground">Sin tarea</span>}
                    {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                    {isRunning && paused && (
                      <span className="text-yellow-500"> · En pausa</span>
                    )}
                  </span>

                  <span className="text-muted-foreground text-[10px]">
                    {new Date(e.started_at).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {!isRunning && (
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
