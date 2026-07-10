import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createPhase, deletePhase, fetchPhases, fetchTasks, updatePhase } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Settings as SettingsIcon, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const phasesQ = useQuery({ queryKey: ["phases"], queryFn: fetchPhases });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [edits, setEdits] = useState<Record<string, { name: string; description: string }>>({});

  const isDev = role === "developer";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["phases"] });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const nextIdx = (phasesQ.data ?? []).reduce((m, p) => Math.max(m, p.order_index), 0) + 1;
    try {
      await createPhase(newName.trim(), newDesc.trim() || null, nextIdx);
      toast.success("Fase creada");
      setNewName(""); setNewDesc("");
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleSave = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    try {
      await updatePhase(id, { name: e.name, description: e.description || null });
      toast.success("Fase actualizada");
      setEdits((p) => { const { [id]: _, ...rest } = p; return rest; });
      invalidate();
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleDelete = async (id: string) => {
    const used = (tasksQ.data ?? []).some((t) => t.phase_id === id);
    if (used) return toast.error("No se puede eliminar: la fase tiene tareas.");
    if (!confirm("¿Eliminar esta fase?")) return;
    try {
      await deletePhase(id);
      toast.success("Fase eliminada");
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (phasesQ.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-primary mb-1 flex items-center gap-2">
          <SettingsIcon className="h-3.5 w-3.5" /> Ajustes
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Fases del proyecto</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isDev ? "Crea, renombra o elimina fases." : "Solo Alberto puede editar fases."}
        </p>
      </header>

      <div className="space-y-3 mb-8">
        {(phasesQ.data ?? []).map((p) => {
          const e = edits[p.id] ?? { name: p.name, description: p.description ?? "" };
          const dirty = !!edits[p.id];
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-[11px] font-mono text-muted-foreground mt-2">
                  F{p.order_index.toString().padStart(2, "0")}
                </span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={e.name}
                    disabled={!isDev}
                    onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { ...e, name: ev.target.value } }))}
                  />
                  <Textarea
                    value={e.description}
                    disabled={!isDev}
                    onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { ...e, description: ev.target.value } }))}
                    className="min-h-16 text-sm"
                  />
                </div>
                {isDev && (
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" disabled={!dirty} onClick={() => handleSave(p.id)}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {isDev && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Nueva fase</h2>
          <div className="space-y-2">
            <div>
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="mt-1.5 min-h-16" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Crear fase
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
