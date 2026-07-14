"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Eye, Smartphone, Moon, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { substituteVariables } from "@/lib/templates/engine";
import type { Contact } from "@prisma/client";

interface TemplateData {
  id: string;
  name: string;
  content: string;
  versions: { id: string; version: number; content: string; createdAt: string }[];
}

const SAMPLE_CONTACT: Contact = {
  id: "sample",
  name: "Ankit Kumar",
  email: "ankit@example.com",
  phone: "+91 98765 43210",
  whatsapp: "+91 98765 43210",
  college: "IIT Delhi",
  year: "2024",
  branch: "Computer Science",
  department: "Engineering",
  city: "New Delhi",
  state: "Delhi",
  skills: "React, Node.js, Python",
  resumeUrl: "",
  linkedinUrl: "https://linkedin.com/in/ankit",
  source: "Campus Drive",
  notes: "",
  customFields: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | "dark">("desktop");
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    fetch(`/api/templates/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setTemplate(data);
          setName(data.name);
          setContent(data.content);
        }
      });
  }, [id]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });

    if (res.ok) {
      toast.success("Template saved");
      const updated = await fetch(`/api/templates/${id}`).then((r) => r.json());
      setTemplate(updated);
    } else {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  const renderedHtml = content
    ? substituteVariables(content, SAMPLE_CONTACT)
    : "";

  if (!template) return <div className="animate-pulse"><div className="h-8 bg-muted rounded w-48" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-bold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
          />
        </div>
        <Button variant="outline" onClick={() => setShowVersions(!showVersions)}>
          <History className="mr-2 h-4 w-4" />
          Versions ({template.versions.length})
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">HTML Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
                placeholder="Enter your HTML template here..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Variables: {"{{name}}"}, {"{{email}}"}, {"{{phone}}"}, {"{{college}}"}, {"{{year}}"}, {"{{branch}}"}, {"{{department}}"}, {"{{city}}"}, {"{{state}}"}, {"{{skills}}"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Preview</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={previewMode === "desktop" ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewMode === "mobile" ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewMode === "dark" ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreviewMode("dark")}
                  >
                    <Moon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`border rounded-lg overflow-hidden ${
                  previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""
                } ${previewMode === "dark" ? "bg-gray-900" : "bg-white"}`}
              >
                <iframe
                  srcDoc={renderedHtml}
                  className="w-full min-h-[400px] border-0"
                  title="Template Preview"
                  sandbox="allow-same-origin"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Preview uses sample data: {SAMPLE_CONTACT.name} ({SAMPLE_CONTACT.email})
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Version History */}
      {showVersions && (
        <Card>
          <CardHeader><CardTitle className="text-base">Version History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {template.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">Version {v.version}</p>
                    <p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContent(v.content)}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
