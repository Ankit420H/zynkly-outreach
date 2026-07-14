import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testConnection } from "@/lib/email/engine";
import { validateVariables } from "@/lib/templates/engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      smtpProfile: true,
      template: true,
      attachments: { include: { attachment: true } },
      queueItems: { include: { contact: true } },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const issues: { type: "error" | "warning"; message: string }[] = [];

  // 1. Validate SMTP connectivity
  const smtpTest = await testConnection(campaign.smtpProfile);
  if (!smtpTest.success) {
    issues.push({ type: "error", message: `SMTP connection failed: ${smtpTest.error}` });
  }

  // 2. Validate template
  if (!campaign.template.content.trim()) {
    issues.push({ type: "error", message: "Template content is empty" });
  }

  // 3. Validate variable substitution
  const { invalid } = validateVariables(campaign.template.content);
  if (invalid.length > 0) {
    issues.push({
      type: "warning",
      message: `Unknown template variables: ${invalid.join(", ")}`,
    });
  }

  // 4. Check attachments exist
  for (const ca of campaign.attachments) {
    if (!ca.attachment.url) {
      issues.push({ type: "error", message: `Missing attachment: ${ca.attachment.filename}` });
    }
  }

  // 5. Check for invalid emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = campaign.queueItems.filter(
    (qi) => !emailRegex.test(qi.contact.email)
  );
  if (invalidEmails.length > 0) {
    issues.push({
      type: "error",
      message: `${invalidEmails.length} recipient(s) have invalid email addresses`,
    });
  }

  // 6. Check for duplicates
  const emails = campaign.queueItems.map((qi) => qi.contact.email);
  const uniqueEmails = new Set(emails);
  if (emails.length !== uniqueEmails.size) {
    issues.push({
      type: "warning",
      message: `${emails.length - uniqueEmails.size} duplicate recipient(s) detected`,
    });
  }

  // 7. Check recipient count
  if (campaign.queueItems.length === 0) {
    issues.push({ type: "error", message: "No recipients selected for this campaign" });
  }

  // 8. Estimate completion time
  const estimatedSeconds = campaign.queueItems.length * campaign.delaySeconds;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  const hasErrors = issues.some((i) => i.type === "error");
  const passed = !hasErrors;

  // Update campaign status based on dry run result
  if (passed) {
    await db.campaign.update({
      where: { id },
      data: { status: "READY" },
    });
  }

  return NextResponse.json({
    passed,
    issues,
    recipientCount: campaign.queueItems.length,
    estimatedMinutes,
    estimatedSeconds,
  });
}
