import {
  substituteVariables,
  extractVariables,
  validateVariables,
  renderEmail,
} from "@/lib/templates/engine";
import type { Contact } from "@prisma/client";

const mockContact: Contact = {
  id: "test-1",
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
  skills: "React, Node.js",
  resumeUrl: null,
  linkedinUrl: null,
  source: null,
  notes: null,
  customFields: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Template Engine", () => {
  describe("substituteVariables", () => {
    it("replaces {{name}} with contact name", () => {
      const result = substituteVariables("Hello {{name}}!", mockContact);
      expect(result).toBe("Hello Ankit Kumar!");
    });

    it("replaces {{email}} with contact email", () => {
      const result = substituteVariables("Email: {{email}}", mockContact);
      expect(result).toBe("Email: ankit@example.com");
    });

    it("replaces multiple variables", () => {
      const result = substituteVariables("{{name}} from {{college}}, {{year}}", mockContact);
      expect(result).toBe("Ankit Kumar from IIT Delhi, 2024");
    });

    it("leaves unknown variables unchanged", () => {
      const result = substituteVariables("Hello {{unknown}}!", mockContact);
      expect(result).toBe("Hello {{unknown}}!");
    });

    it("handles case-insensitive variables", () => {
      const result = substituteVariables("{{NAME}}", mockContact);
      expect(result).toBe("Ankit Kumar");
    });
  });

  describe("extractVariables", () => {
    it("extracts all variable names", () => {
      const vars = extractVariables("{{name}} {{email}} {{college}}");
      expect(vars).toEqual(expect.arrayContaining(["name", "email", "college"]));
    });

    it("deduplicates variables", () => {
      const vars = extractVariables("{{name}} {{name}} {{email}}");
      expect(vars).toHaveLength(2);
    });
  });

  describe("validateVariables", () => {
    it("identifies valid variables", () => {
      const { valid, invalid } = validateVariables("{{name}} {{email}}");
      expect(valid).toContain("name");
      expect(valid).toContain("email");
      expect(invalid).toHaveLength(0);
    });

    it("identifies invalid variables", () => {
      const { valid, invalid } = validateVariables("{{name}} {{fakevar}}");
      expect(valid).toContain("name");
      expect(invalid).toContain("fakevar");
    });
  });

  describe("renderEmail", () => {
    it("substitutes variables", () => {
      const template = "<body><p>Hello {{name}}</p></body>";
      const result = renderEmail(template, mockContact);
      expect(result).toContain("Hello Ankit Kumar");
      expect(result).not.toContain("Zynkly");
    });
  });
});
