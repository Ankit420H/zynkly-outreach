// app/api/campaigns/preflight/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testConnection } from "@/lib/email/engine";
import { validateVariables } from "@/lib/templates/engine";
import { createHandler } from "@/lib/api/handler";
import { campaignSchema } from "@/lib/validations";

interface DryRunRequest {
  name: string;
  smtpProfileId: string;
  templateId: string;
  delaySeconds: number;
  scheduledAt: string | null;
  contactIds: string[];
  tagIds: string[];
  attachmentIds: string[];
}

export const POST = createHandler(
  async (req) => {
    // Access validated body through type assertion
    const body = (req as unknown as { validatedBody: DryRunRequest }).validatedBody;
    const { smtpProfileId, templateId, delaySeconds, contactIds, tagIds, attachmentIds } = body;

    // Resolve recipients: explicit contacts + tag-based
    const blacklisted = await db.blacklistEntry.findMany({ select: { email: true } });
    const blacklistedEmails = new Set(blacklisted.map((b) => b.email));
    const recipientIds = new Set<string>();

    if (contactIds.length > 0) {
      contactIds.forEach((id) => recipientIds.add(id));
    }

    if (tagIds.length > 0) {
      const tagContacts = await db.contactTag.findMany({
        where: { tagId: { in: tagIds } },
        select: { contactId: true },
      });
      tagContacts.forEach((tc) => recipientIds.add(tc.contactId));
    }

    // If no explicit selection, include all contacts
    if (contactIds.length === 0 && tagIds.length === 0) {
      const allContacts = await db.contact.findMany({ select: { id: true } });
      allContacts.forEach((c) => recipientIds.add(c.id));
    }

    // Filter out blacklisted
    const contacts = await db.contact.findMany({
      where: { id: { in: [...recipientIds] } },
      select: { id: true, email: true },
    });

    const validRecipients = contacts.filter((c) => !blacklistedEmails.has(c.email));

    // Fetch related data
    const [smtpProfile, template, attachments] = await Promise.all([
      db.smtpProfile.findUnique({ where: { id: smtpProfileId } }),
      db.template.findUnique({ where: { id: templateId } }),
      db.attachment.findMany({ where: { id: { in: attachmentIds } } }),
    ]);

    if (!smtpProfile) {
      return NextResponse.json({ error: "SMTP profile not found" }, { status: 404 });
    }
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const issues: { type: "error" | "warning"; message: string }[] = [];

    // 1. Validate SMTP connectivity
    const smtpTest = await testConnection(smtpProfile);
    if (!smtpTest.success) {
      issues.push({ type: "error", message: `SMTP connection failed: ${smtpTest.error}` });
    }

    // 2. Validate template
    if (!template.content.trim()) {
      issues.push({ type: "error", message: "Template content is empty" });
    }

    // 3. Validate variable substitution
    const { invalid } = validateVariables(template.content);
    if (invalid.length > 0) {
      issues.push({
        type: "warning",
        message: `Unknown template variables: ${invalid.join(", ")}`,
      });
    }

    // 4. Check attachments exist
    for (const att of attachments) {
      if (!att.url) {
        issues.push({ type: "error", message: `Missing attachment: ${att.filename}` });
      }
    }

    // 5. Check for invalid emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validRecipients.filter((c) => !emailRegex.test(c.email));
    if (invalidEmails.length > 0) {
      issues.push({
        type: "error",
        message: `${invalidEmails.length} recipient(s) have invalid email addresses`,
      });
    }

    // 6. Check for duplicates
    const emails = validRecipients.map((c) => c.email);
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      issues.push({
        type: "warning",
        message: `${emails.length - uniqueEmails.size} duplicate recipient(s) detected`,
      });
    }

    // 7. Check recipient count
    if (validRecipients.length === 0) {
      issues.push({ type: "error", message: "No recipients selected for this campaign" });
    }

    // 8. Estimate completion time
    const estimatedSeconds = validRecipients.length * delaySeconds;
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

    const hasErrors = issues.some((i) => i.type === "error");
    const passed = !hasErrors;

    return NextResponse.json({
      passed,
      issues,
      recipientCount: validRecipients.length,
      estimatedMinutes,
      estimatedSeconds,
    });
  },
  { validateBody: campaignSchema }
);