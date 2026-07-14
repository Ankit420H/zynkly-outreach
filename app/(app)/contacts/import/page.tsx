"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  parseFile,
  processImport,
  type ImportResult,
} from "@/lib/contacts/import";

type Step = "upload" | "preview" | "importing" | "done";

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });
  const [parseError, setParseError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  function parseWithWorker(text: string, format: "csv" | "tsv") {
    setParseError(null);
    setParseProgress({ current: 0, total: 0 });

    const worker = new Worker(
      new URL("@/lib/contacts/import.worker.ts", import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      
      if (msg.type === "row") {
        setParseProgress((prev) => ({
          ...prev,
          current: prev.current + 1,
        }));
      } else if (msg.type === "done") {
        setParseProgress((prev) => ({
          ...prev,
          total: msg.totalRows,
        }));
      } else if (msg.type === "complete") {
        const importResult = processImport(msg.result.rows);
        setResult(importResult);
        setStep("preview");
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === "error") {
        setParseError(msg.error);
        toast.error(`Parse error: ${msg.error}`);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      setParseError(err.message || "Worker error");
      toast.error("Worker failed, falling back to main thread");
      worker.terminate();
      workerRef.current = null;
      
      // Fallback to main thread parsing
      try {
        const rows = format === "tsv" 
          ? (Papa.parse(text, { header: true, delimiter: "\t" }).data as Record<string, string>[])
          : (Papa.parse(text, { header: true }).data as Record<string, string>[]);
        const importResult = processImport(rows);
        setResult(importResult);
        setStep("preview");
      } catch {
        toast.error("Fallback parsing also failed");
      }
    };

    worker.postMessage({ text, format });
  }

  const handleFile = useCallback(async (file: File) => {
    try {
      const format = file.name.toLowerCase().split(".").pop();
      
      // Use Web Worker for CSV/TSV, keep Excel on main thread (xlsx doesn't work in workers easily)
      if (format === "csv" || format === "tsv") {
        const text = await file.text();
        parseWithWorker(text, format === "tsv" ? "tsv" : "csv");
      } else {
        // Excel or other formats - parse on main thread
        const rows = await parseFile(file);
        const importResult = processImport(rows);
        setResult(importResult);
        setStep("preview");
      }
    } catch {
      toast.error("Failed to parse file. Please check the format.");
    }
  }, []);

  function handleRawTextParse() {
    if (!rawText.trim()) {
      toast.error("Please paste some data first");
      return;
    }
    const rows = parseRawTextClient(rawText);
    const importResult = processImport(rows);
    setResult(importResult);
    setStep("preview");
  }

  function parseRawTextClient(text: string): Record<string, string>[] {
    const lines = text.trim().split("\n").filter((l) => l.trim());
    const rows: Record<string, string>[] = [];

    for (const line of lines) {
      const parts = line.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      const row: Record<string, string> = {};
      for (const part of parts) {
        if (part.startsWith("p:") || /^\+?\d[\d\-() ]{7,}$/.test(part)) {
          row.phone = part.startsWith("p:") ? part.slice(2) : part;
        } else if (part.includes("@") && part.includes(".")) {
          row.email = part;
        } else if (/^\d{4}$/.test(part)) {
          row.year = part;
        } else if (!row.name) {
          row.name = part;
        } else if (!row.college) {
          row.college = part;
        } else {
          row.notes = (row.notes ? row.notes + ", " : "") + part;
        }
      }
      if (row.name && row.email) {
        rows.push(row);
      }
    }
    return rows;
  }

  async function commitImport() {
    if (!result || result.valid.length === 0) return;
    setImporting(true);
    setStep("importing");

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          result.valid.map((row) => ({
            name: row.name,
            email: row.email,
            phone: row.phone || "",
            whatsapp: row.whatsapp || "",
            college: row.college || "",
            year: row.year || "",
            branch: row.branch || "",
            department: row.department || "",
            city: row.city || "",
            state: row.state || "",
            skills: row.skills || "",
            resumeUrl: row.resumeUrl || "",
            linkedinUrl: row.linkedinUrl || "",
            source: row.source || "",
            notes: row.notes || "",
          }))
        ),
      });

      if (res.ok) {
        const data = await res.json();
        setImportedCount(data.created);
        setStep("done");
        toast.success(`${data.created} contacts imported successfully`);
      } else {
        toast.error("Import failed");
        setStep("preview");
      }
    } finally {
      setImporting(false);
    }
  }

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  if (step === "done") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Import Complete</h2>
            <p className="text-muted-foreground mt-2">
              {importedCount} contacts imported successfully
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Button variant="outline" onClick={() => { setStep("upload"); setResult(null); setRawText(""); }}>
                Import More
              </Button>
              <Button onClick={() => router.push("/contacts")}>
                View Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "preview" && result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Import Preview</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep("upload"); setResult(null); }}>
              Back
            </Button>
            <Button onClick={commitImport} disabled={result.valid.length === 0 || importing}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${result.valid.length} Contacts`
              )}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold">{result.totalRows}</p>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold text-green-600">{result.valid.length}</p>
              <p className="text-sm text-muted-foreground">Valid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold text-red-600">{result.invalid.length}</p>
              <p className="text-sm text-muted-foreground">Invalid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-bold text-yellow-600">{result.duplicates.length}</p>
              <p className="text-sm text-muted-foreground">Duplicates</p>
            </CardContent>
          </Card>
        </div>

        {/* Invalid Rows */}
        {result.invalid.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {result.invalid.length} rows failed validation and will be skipped:
              <ul className="mt-2 space-y-1">
                {result.invalid.slice(0, 5).map((inv) => (
                  <li key={inv.row} className="text-sm">
                    Row {inv.row}: {inv.errors.join(", ")}
                  </li>
                ))}
                {result.invalid.length > 5 && (
                  <li className="text-sm">...and {result.invalid.length - 5} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview Table */}
        <Card>
          <CardHeader>
            <CardTitle>Valid Contacts Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>College</TableHead>
                    <TableHead>Year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.valid.slice(0, 20).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.phone || "—"}</TableCell>
                      <TableCell>{row.college || "—"}</TableCell>
                      <TableCell>{row.year || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {result.valid.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        ...and {result.valid.length - 20} more
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold">Importing Contacts...</h2>
            <p className="text-muted-foreground mt-2">
              Please wait while we import {result?.valid.length || 0} contacts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Import Contacts</h1>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload File
          </CardTitle>
          <CardDescription>
            Supports Excel (.xlsx, .xls), CSV, and TSV files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              .xlsx, .xls, .csv, .tsv
            </p>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,.tsv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          {parseProgress.total > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Parsing...</span>
                <span className="text-muted-foreground">
                  {parseProgress.current} / {parseProgress.total} rows
                </span>
              </div>
              <Progress 
                value={parseProgress.total > 0 ? (parseProgress.current / parseProgress.total) * 100 : 0} 
                className="h-2" 
              />
            </div>
          )}
          {parseError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Raw Text */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Paste Raw Data
          </CardTitle>
          <CardDescription>
            Paste tab or space-separated data. Format: Name  Phone  Email  College  Year
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`John Doe   p:+919876543210   john@example.com   MIT   2024\nJane Smith   p:+919123456789   jane@example.com   IIT Delhi   2023`}
            rows={6}
            className="font-mono text-sm"
          />
          <Button onClick={handleRawTextParse} disabled={!rawText.trim()}>
            Parse & Preview
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}