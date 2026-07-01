import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, fetchTasks } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { TaskPriority, TaskType, TaskVisibility } from "@/lib/types";

interface Props {
  phaseId: string;
  defaultType: TaskType;
  onClose: () => void;
}

export function NewTaskDialog({ phaseId, defaultType, onClose }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const allTasksQ = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [type, setType] = useState<TaskType>(defaultType);
  const [parentId, setParentId] = useState<string>("none");
  const [visibility, setVisibility] = useState<TaskVisibility>(defaultType === "executive" ? "visible_pm" : "compartida");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const executives = (allTasksQ.data ?? []).filter((t) => t.type === "executive" && t.phase_id === phaseId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createTask(
        {
          phase_id: phaseId,
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          parent_executive_id: type === "technical" && parentId !== "none" ? parentId : null,
          visibility,
          estimated_hours: estimatedHours ? Number(estimatedHours) : null,
        },
        user?.id ?? null,
      );
      toast.success("Tarea creada");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1.5" />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 min-h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Técnica</SelectItem>
                  <SelectItem value="executive">Ejecutiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {type === "technical" && (
            <div>
              <Label>Enlazar a hito ejecutivo</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {executives.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Visibilidad</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as TaskVisibility)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">Interna (solo Alberto)</SelectItem>
                  <SelectItem value="compartida">Compartida (visible para PM)</SelectItem>
                  <SelectItem value="visible_pm">Hito PM (impacta progreso)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horas estimadas</Label>
              <Input
                type="number" min="0" step="0.25"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="mt-1.5"
                placeholder="p. ej. 1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !title.trim()}>Crear</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
