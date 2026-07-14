import type { Contact } from "@prisma/client";

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

const CONTACT_FIELD_MAP: Record<string, keyof Contact> = {
  name: "name",
  email: "email",
  phone: "phone",
  whatsapp: "whatsapp",
  college: "college",
  year: "year",
  branch: "branch",
  department: "department",
  city: "city",
  state: "state",
  skills: "skills",
};

export function substituteVariables(template: string, contact: Contact): string {
  return template.replace(VARIABLE_REGEX, (match, variable) => {
    const field = CONTACT_FIELD_MAP[variable.toLowerCase()];
    if (field) {
      const value = contact[field];
      return typeof value === "string" ? value : match;
    }
    return match;
  });
}

export function extractVariables(template: string): string[] {
  const matches = template.matchAll(VARIABLE_REGEX);
  return [...new Set([...matches].map(([, name]) => name.toLowerCase()))];
}

export function validateVariables(template: string): { valid: string[]; invalid: string[] } {
  const vars = extractVariables(template);
  const validFields = Object.keys(CONTACT_FIELD_MAP);
  const valid = vars.filter((v) => validFields.includes(v));
  const invalid = vars.filter((v) => !validFields.includes(v));
  return { valid, invalid };
}

export function injectBranding(html: string): string {
  return html;
}

export function renderEmail(template: string, contact: Contact): string {
  return substituteVariables(template, contact);
}
