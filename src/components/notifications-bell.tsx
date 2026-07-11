import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  task_id: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationsBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          toast(n.title, { description: n.body ?? undefined });
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  async function openTask(n: Notification) {
    if (!n.read) await markRead(n.id);
    if (n.task_id) navigate({ to: "/task/$taskId", params: { taskId: n.task_id } });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0" aria-label="Notificaciones">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">Notificaciones</div>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Check className="h-3 w-3" /> Marcar todas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">Sin notificaciones</div>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => openTask(n)}
              className={`w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-accent/40 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{n.title}</div>
                  {n.body && <div className="text-[11px] text-muted-foreground truncate">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(n.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
