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

const ZYNKLY_FOOTER = `
<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
    <tr>
      <td style="padding: 16px 0;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="background: #111; color: #fff; width: 36px; height: 36px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">Z</div>
          <span style="font-size: 18px; font-weight: 600; color: #111;">Zynkly</span>
        </div>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
          Empowering businesses through innovation and technology.
        </p>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">
          <a href="https://zynkly.com" style="color: #2563eb; text-decoration: none;">zynkly.com</a>
          &nbsp;·&nbsp;
          <a href="https://linkedin.com/company/zynkly" style="color: #2563eb; text-decoration: none;">LinkedIn</a>
          &nbsp;·&nbsp;
          <a href="https://instagram.com/zynkly" style="color: #2563eb; text-decoration: none;">Instagram</a>
        </div>
        <p style="margin: 0; font-size: 11px; color: #9ca3af;">
          © ${new Date().getFullYear()} Zynkly. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</div>
`;

export function injectBranding(html: string): string {
  const bodyCloseIndex = html.toLowerCase().lastIndexOf("</body>");
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + ZYNKLY_FOOTER + html.slice(bodyCloseIndex);
  }
  return html + ZYNKLY_FOOTER;
}

export function renderEmail(template: string, contact: Contact): string {
  const substituted = substituteVariables(template, contact);
  return injectBranding(substituted);
}
