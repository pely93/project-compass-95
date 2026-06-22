import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createTasksFromMarkdown, fetchPhases, fetchTasks, parseMarkdownDoc } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { TaskType } from "@/lib/types";

interface Props {
  onClose: () => void;
  defaultPhaseId?: string;
  defaultType?: TaskType;
}

const SAMPLE = `## Fase: F01 Preparación
### Ejecutiva
- Hito: Kickoff
  - Reunión inicial
  - Definir alcance

## Fase: F02 Desarrollo
### Técnica
- Configurar staging
  - Crear subdominio
  - Activar SSL
- Reorganizar el menú principal

## Fase: F02 Desarrollo (interna)
### Técnica
- Limpiar entorno de pruebas`;

export function MarkdownImportDialog({ onClose, defaultPhaseId, defaultType = "technical" }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const phasesQ = useQuery({ queryKey: ["phases"], queryFn: fetchPhases });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });

  const [md, setMd] = useState("");
  const [phaseId, setPhaseId] = useState<string>(defaultPhaseId ?? "");
  const [rootType, setRootType] = useState<TaskType>(defaultType);
  const [parentExec, setParentExec] = useState<string>("none");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sections = useMemo(() => parseMarkdownDoc(md), [md]);
  const totalRoots = sections.reduce((s, sec) => s + sec.roots.length, 0);
  const totalChildren = sections.reduce((s, sec) => s + sec.roots.reduce((a, n) => a + n.children.length, 0), 0);
  const multiSection = sections.some((s) => s.phaseHint);
  const executives = (tasksQ.data ?? []).filter((t) => t.type === "executive" && t.phase_id === phaseId);

  const submit = async () => {
    if (!phaseId) return toast.error("Selecciona una fase");
    if (preview.length === 0) return toast.error("Pega una lista en Markdown");
    setSubmitting(true);
    try {
      const n = await createTasksFromMarkdown({
        md,
        phaseId,
        rootType,
        parentExecutiveId: rootType === "technical" && parentExec !== "none" ? parentExec : null,
        isInternal,
        createdBy: user?.id ?? null,
      });
      toast.success(`Creadas ${n} tareas (+ subtareas)`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar tareas desde Markdown</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>Fase</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecciona fase" /></SelectTrigger>
                <SelectContent>
                  {(phasesQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>F{p.order_index.toString().padStart(2,"0")} · {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo del nivel superior</Label>
              <Select value={rootType} onValueChange={(v) => setRootType(v as TaskType)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Técnica</SelectItem>
                  <SelectItem value="executive">Ejecutiva (hito)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Las viñetas anidadas se crean como técnicas. Si el nivel superior es ejecutivo, se enlazan a él automáticamente.
              </p>
            </div>
            {rootType === "technical" && (
              <div>
                <Label>Enlazar a hito (opcional)</Label>
                <Select value={parentExec} onValueChange={setParentExec}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {executives.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <label className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">Marcar como internas</span>
              <Switch checked={isInternal} onCheckedChange={setIsInternal} />
            </label>
          </div>

          <div className="space-y-2">
            <Label>Markdown</Label>
            <Textarea
              value={md}
              onChange={(e) => setMd(e.target.value)}
              placeholder={SAMPLE}
              className="min-h-[260px] font-mono text-xs"
            />
            <div className="text-[11px] text-muted-foreground">
              Vista previa: <span className="text-foreground">{preview.length} tareas</span>
              {preview.length > 0 && (
                <span> · {preview.reduce((s, n) => s + n.children.length, 0)} subtareas</span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting || preview.length === 0 || !phaseId}>
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
