import * as XLSX from "xlsx";
import Papa from "papaparse";
import { contactImportRowSchema } from "@/lib/validations";

export interface ImportRow {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  college?: string;
  year?: string;
  branch?: string;
  department?: string;
  city?: string;
  state?: string;
  skills?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  source?: string;
  notes?: string;
}

export interface ImportResult {
  valid: ImportRow[];
  invalid: { row: number; data: Record<string, string>; errors: string[] }[];
  duplicates: { row: number; email: string }[];
  totalRows: number;
}

const COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  "contact name": "name",
  email: "email",
  "email address": "email",
  "e-mail": "email",
  mail: "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  "contact number": "phone",
  tel: "phone",
  whatsapp: "whatsapp",
  "whatsapp number": "whatsapp",
  wa: "whatsapp",
  college: "college",
  university: "college",
  institution: "college",
  school: "college",
  year: "year",
  "graduation year": "year",
  batch: "year",
  branch: "branch",
  stream: "branch",
  major: "branch",
  department: "department",
  dept: "department",
  city: "city",
  location: "city",
  state: "state",
  province: "state",
  skills: "skills",
  "skill set": "skills",
  resume: "resumeUrl",
  "resume url": "resumeUrl",
  "resume link": "resumeUrl",
  linkedin: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  "linkedin link": "linkedinUrl",
  source: "source",
  origin: "source",
  notes: "notes",
  remarks: "notes",
  comment: "notes",
  comments: "notes",
};

function normalizeColumnName(col: string): string | null {
  const normalized = col.toLowerCase().trim();
  return COLUMN_ALIASES[normalized] || null;
}

function cleanPhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.trim();
  if (cleaned.startsWith("p:")) cleaned = cleaned.slice(2);
  cleaned = cleaned.replace(/[^\d+\-() ]/g, "").trim();
  return cleaned;
}

function normalizeRow(raw: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = normalizeColumnName(key);
    if (mapped && value !== undefined && value !== null) {
      let val = String(value).trim();
      if (mapped === "phone" || mapped === "whatsapp") {
        val = cleanPhone(val);
      }
      if (mapped === "email") {
        val = val.toLowerCase();
      }
      result[mapped] = val;
    }
  }
  return result;
}

export function parseExcel(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}

export function parseTsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: "\t",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}

export function parseRawText(text: string): Record<string, string>[] {
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

export function detectFormat(filename: string): "excel" | "csv" | "tsv" | "text" {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xls") return "excel";
  if (ext === "csv") return "csv";
  if (ext === "tsv") return "tsv";
  return "text";
}

export function processImport(rawRows: Record<string, string>[]): ImportResult {
  const seen = new Set<string>();
  const valid: ImportRow[] = [];
  const invalid: ImportResult["invalid"] = [];
  const duplicates: ImportResult["duplicates"] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const normalized = normalizeRow(rawRows[i]);
    const result = contactImportRowSchema.safeParse(normalized);

    if (!result.success) {
      invalid.push({
        row: i + 1,
        data: normalized,
        errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      });
      continue;
    }

    const email = result.data.email.toLowerCase();
    if (seen.has(email)) {
      duplicates.push({ row: i + 1, email });
      continue;
    }

    seen.add(email);
    valid.push(result.data as ImportRow);
  }

  return { valid, invalid, duplicates, totalRows: rawRows.length };
}

export async function parseFile(file: File): Promise<Record<string, string>[]> {
  const format = detectFormat(file.name);

  if (format === "excel") {
    const buffer = await file.arrayBuffer();
    return parseExcel(buffer);
  }

  const text = await file.text();
  if (format === "csv") return parseCsv(text);
  if (format === "tsv") return parseTsv(text);
  return parseRawText(text);
}
