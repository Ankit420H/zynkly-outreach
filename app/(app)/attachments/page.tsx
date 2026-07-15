"use client";

import { useEffect, useState } from "react";
import { Upload, Trash2, Paperclip, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Attachment {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentsPage() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function fetchAttachments() {
    const res = await fetch("/api/attachments");
    if (res.ok) setAttachments(await res.json());
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAttachments(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/attachments", { method: "POST", body: formData });
    if (res.ok) {
      toast.success("File uploaded");
      fetchAttachments();
    } else {
      let errorMessage = "Upload failed";
      try {
        const err = await res.json();
        errorMessage = err.error?.message || errorMessage;
      } catch {
        // If it's a 500 crash, it might not be JSON
      }
      toast.error(errorMessage);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function deleteAttachment(id: string) {
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Attachment deleted");
      fetchAttachments();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Attachments</h1>
        <div>
          <input
            type="file"
            id="attachment-upload"
            className="hidden"
            accept=".pdf,.docx,.pptx,.zip,.png,.jpg,.jpeg"
            onChange={handleUpload}
          />
          <Button asChild disabled={uploading}>
            <label htmlFor="attachment-upload" className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload File"}
            </label>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>)}
        </div>
      ) : attachments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Paperclip className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No attachments yet. Upload files to reuse across campaigns.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {attachments.map((a) => (
            <Card key={a.id} className="group">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:underline truncate block"
                    >
                      {a.filename}
                    </a>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{a.mimeType.split("/").pop()}</Badge>
                      <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteAttachment(a.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
