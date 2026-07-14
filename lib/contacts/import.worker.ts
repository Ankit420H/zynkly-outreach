// lib/contacts/import.worker.ts
import Papa from "papaparse";

export interface ParseProgress {
  type: "row" | "done" | "error" | "complete";
  data?: Record<string, string>;
  rowNumber?: number;
  totalRows?: number;
  error?: string;
  result?: ParseResult;
}

export interface ParseResult {
  rows: Record<string, string>[];
  totalRows: number;
  errors: string[];
}

self.onmessage = async (e: MessageEvent<{ text: string; format: "csv" | "tsv" }>) => {
  const { text, format } = e.data;

  try {
    const result = await parseWithPapa(text, format);
    
    if (result.errors.length > 0) {
      self.postMessage({
        type: "error",
        error: result.errors[0],
      } as ParseProgress);
    }

    self.postMessage({
      type: "done",
      totalRows: result.rows.length,
    } as ParseProgress);

    // Transfer the result back
    self.postMessage({
      type: "complete",
      result,
    } as ParseProgress);
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : "Unknown parsing error",
    } as ParseProgress);
  }
};

function parseWithPapa(text: string, format: "csv" | "tsv"): Promise<ParseResult> {
  const rows: Record<string, string>[] = [];
  const errors: string[] = [];

  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: format === "tsv" ? "\t" : ",",
      transformHeader: (h) => h.trim(),
      chunk: (results: { data: Record<string, string>[] }) => {
        for (const row of results.data) {
          if (row && Object.keys(row).length > 0) {
            rows.push(row);
          }
        }
      },
      error: (err: Error) => {
        errors.push(err.message);
      },
      complete: () => {
        resolve({ rows, totalRows: rows.length, errors });
      },
    });
  });
}