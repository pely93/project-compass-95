import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
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
import { FileText, Upload, Download, Trash2, Loader2, Filter, Lock, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { fetchProfiles } from "@/lib/api";

const BUCKET = "project-docs";
const CATEGORIES = [
  { value: "contrato", label: "Contrato" },
  { value: "anexo", label: "Anexo" },
  { value: "factura", label: "Factura" },
  { value: "otro", label: "Otro" },
] as const;
type Category = (typeof CATEGORIES)[number]["value"];

interface DocRow {
  id: string;
  category: Category;
  name: string;
  description: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  is_shared: boolean;
  created_at: string;
}

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function DocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [category, setCategory] = useState<Category>("contrato");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const docsQ = useQuery({
    queryKey: ["project_documents"],
    queryFn: async (): Promise<DocRow[]> => {
      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const profilesQ = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [profilesQ.data]);

  const filtered = useMemo(
    () => (docsQ.data ?? []).filter((d) => filter === "all" || d.category === filter),
    [docsQ.data, filter],
  );

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("project_documents").insert({
        category,
        name: file.name,
        description: description.trim() || null,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Documento subido");
      qc.invalidateQueries({ queryKey: ["project_documents"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (d: DocRow) => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(d.storage_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (d: DocRow) => {
    if (!confirm(`¿Eliminar "${d.name}"?`)) return;
    try {
      await supabase.storage.from(BUCKET).remove([d.storage_path]);
      const { error } = await supabase.from("project_documents").delete().eq("id", d.id);
      if (error) throw error;
      toast.success("Documento eliminado");
      qc.invalidateQueries({ queryKey: ["project_documents"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wider text-primary mb-1 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> Documentos del proyecto
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Contratos, anexos y facturas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Espacio compartido entre Alberto y Gloria para adjuntar documentación oficial del proyecto.
        </p>
      </header>

      <Card className="p-4 mb-6 space-y-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" /> Subir documento
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Archivo</Label>
            <Input
              ref={fileRef}
              type="file"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Descripción (opcional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Contrato firmado 07/2026, Anexo alcance F03…"
            rows={2}
          />
        </div>
        {uploading && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Subiendo…
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={filter} onValueChange={(v) => setFilter(v as Category | "all")}>
          <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} documento(s)</span>
      </div>

      <Card className="divide-y divide-border">
        {docsQ.isLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Sin documentos todavía.</div>
        ) : (
          filtered.map((d) => {
            const canDelete = user?.id === d.uploaded_by;
            const label = CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category;
            const uploader = d.uploaded_by ? profileMap.get(d.uploaded_by) ?? "—" : "—";
            return (
              <div key={d.id} className="px-4 py-3 flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{d.name}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {label}
                    </span>
                  </div>
                  {d.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{d.description}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {uploader} · {formatSize(d.size_bytes)} ·{" "}
                    {new Date(d.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(d)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(d)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
