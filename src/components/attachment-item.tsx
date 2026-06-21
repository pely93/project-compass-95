import { useEffect, useState } from "react";
import { getAttachmentSignedUrl, deleteAttachment } from "@/lib/api";
import { Link as LinkIcon, FileText, ImageIcon, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Attachment } from "@/lib/types";

interface Props {
  attachment: Attachment;
  canDelete: boolean;
  onDeleted: () => void;
}

export function AttachmentItem({ attachment: a, canDelete, onDeleted }: Props) {
  const isLink = a.kind === "link";
  const [signed, setSigned] = useState<string | null>(isLink ? a.url : null);
  const [loading, setLoading] = useState(!isLink);

  useEffect(() => {
    if (isLink) return;
    let cancelled = false;
    setLoading(true);
    getAttachmentSignedUrl(a.url)
      .then((u) => !cancelled && setSigned(u))
      .catch((e) => !cancelled && toast.error((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [a.url, isLink]);

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${a.name}"?`)) return;
    try {
      await deleteAttachment(a.id, isLink ? null : a.url, a.kind);
      onDeleted();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const Icon = a.kind === "image" ? ImageIcon : a.kind === "pdf" ? FileText : a.kind === "file" ? FileText : LinkIcon;

  return (
    <li className="rounded-md border border-border bg-muted/30 overflow-hidden">
      {a.kind === "image" && signed && (
        <a href={signed} target="_blank" rel="noreferrer" className="block bg-background">
          <img src={signed} alt={a.name} className="w-full max-h-80 object-contain" loading="lazy" />
        </a>
      )}
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate flex-1">{a.name}</span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : signed ? (
          <a
            href={signed}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            {isLink ? "Abrir" : <><Download className="h-3 w-3" /> Abrir</>}
          </a>
        ) : null}
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDelete}>
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
      </div>
    </li>
  );
}
