import {
  parseCsv,
  parseTsv,
  parseRawText,
  processImport,
} from "@/lib/contacts/import";

describe("Contact Import Pipeline", () => {
  describe("parseCsv", () => {
    it("parses CSV with header row", () => {
      const csv = "name,email,phone,college\nJohn Doe,john@example.com,+919876543210,IIT Delhi";
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("John Doe");
      expect(rows[0].email).toBe("john@example.com");
    });

    it("skips empty lines", () => {
      const csv = "name,email\nJohn,john@example.com\n\n\nJane,jane@example.com";
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(2);
    });
  });

  describe("parseTsv", () => {
    it("parses TSV with header row", () => {
      const tsv = "name\temail\tphone\nJohn Doe\tjohn@example.com\t+919876543210";
      const rows = parseTsv(tsv);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("John Doe");
    });
  });

  describe("parseRawText", () => {
    it("parses space-separated lines", () => {
      const text = "John Doe  p:+919876543210  john@example.com  IIT Delhi  2024";
      const rows = parseRawText(text);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("John Doe");
      expect(rows[0].email).toBe("john@example.com");
    });

    it("strips p: prefix from phone", () => {
      const text = "Jane Smith  p:+919123456789  jane@example.com";
      const rows = parseRawText(text);
      expect(rows[0].phone).not.toContain("p:");
    });

    it("skips rows without email", () => {
      const text = "Name Only  NoEmail";
      const rows = parseRawText(text);
      expect(rows).toHaveLength(0);
    });
  });

  describe("processImport", () => {
    it("validates and separates valid/invalid rows", () => {
      const rows = [
        { name: "Valid Person", email: "valid@example.com", phone: "+919876543210" },
        { name: "Invalid", email: "not-an-email", phone: "" },
      ];
      const result = processImport(rows);
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
      expect(result.valid[0].email).toBe("valid@example.com");
    });

    it("deduplicates by email", () => {
      const rows = [
        { name: "Person A", email: "same@example.com" },
        { name: "Person B", email: "same@example.com" },
      ];
      const result = processImport(rows);
      expect(result.valid).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
    });

    it("normalizes email to lowercase", () => {
      const rows = [{ name: "Test", email: "Test@Example.COM" }];
      const result = processImport(rows);
      expect(result.valid[0].email).toBe("test@example.com");
    });

    it("counts total rows correctly", () => {
      const rows = [
        { name: "A", email: "a@example.com" },
        { name: "B", email: "invalid-email" },
      ];
      const result = processImport(rows);
      expect(result.totalRows).toBe(2);
    });
  });
});
