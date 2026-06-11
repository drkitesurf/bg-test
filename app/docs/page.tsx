"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useTable } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { documentSchema } from "@/lib/validation";
import { Document, DocumentType } from "@/types";

const types: DocumentType[] = ["strategy", "legal", "pitch", "financial", "clinical", "other"];

export default function DocsPage() {
  const api = useTable("documents");
  const [selected, setSelected] = useState<Document | null>(null);
  const current = selected ?? api.rows[0] ?? null;

  async function save(formData: FormData) {
    const parsed = documentSchema.parse({
      title: formData.get("title")?.toString() ?? "",
      type: formData.get("type")?.toString() ?? "other",
      url: formData.get("url")?.toString() ?? "",
      content_md: formData.get("content_md")?.toString() ?? "",
    });
    const payload = { ...parsed, updated_at: new Date().toISOString() };
    const row = current ? await api.update(current.id, payload) : await api.create(payload);
    setSelected(row);
    toast.success("Document saved");
  }

  async function addDoc() {
    const row = await api.create({ title: "Untitled document", type: "other", url: "", content_md: "# Untitled\n", updated_at: new Date().toISOString() });
    setSelected(row);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">Document vault</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Docs</h1>
          <p className="text-muted-foreground">Strategy, pitch, legal, financial, and clinical documents with markdown preview.</p>
        </div>
        <Button onClick={() => void addDoc()}><Plus className="h-4 w-4" /> Add document</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Vault</CardTitle>
            <CardDescription>{api.rows.length} documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {api.rows.map((doc) => (
              <button key={doc.id} className="w-full rounded-lg border border-border bg-background/50 p-3 text-left hover:bg-secondary" onClick={() => setSelected(doc)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{doc.title}</span>
                  <Badge tone="muted">{doc.type}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Updated {formatDate(doc.updated_at.slice(0, 10))}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Edit</CardTitle>
              <CardDescription>Autosave is intentionally off; click save when ready.</CardDescription>
            </CardHeader>
            <CardContent>
              {current ? (
                <form action={save} className="space-y-4">
                  <div className="grid gap-2"><Label>Title</Label><Input name="title" defaultValue={current.title} /></div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue={current.type}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</Select>
                  </div>
                  <div className="grid gap-2"><Label>External URL</Label><Input name="url" defaultValue={current.url} /></div>
                  <div className="grid gap-2"><Label>Markdown</Label><Textarea name="content_md" defaultValue={current.content_md} className="min-h-[420px] font-mono" /></div>
                  <div className="flex gap-2">
                    <Button type="submit">Save document</Button>
                    <Button type="button" variant="destructive" onClick={() => void api.remove(current.id).then(() => setSelected(null))}><Trash2 className="h-4 w-4" /> Delete</Button>
                    {current.url ? <Button type="button" variant="outline" onClick={() => window.open(current.url, "_blank")}><ExternalLink className="h-4 w-4" /> Open URL</Button> : null}
                  </div>
                </form>
              ) : (
                <p className="text-muted-foreground">Create a document to start.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Rendered markdown.</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none text-foreground">
              <ReactMarkdown>{current?.content_md ?? "No document selected."}</ReactMarkdown>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
