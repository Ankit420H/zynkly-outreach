import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validations";
import { CampaignStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as CampaignStatus | null;

  const where = status ? { status } : {};

  const campaigns = await db.campaign.findMany({
    where,
    include: {
      smtpProfile: { select: { id: true, label: true, fromEmail: true } },
      template: { select: { id: true, name: true } },
      _count: { select: { queueItems: true, attachments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = campaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const { contactIds, tagIds, attachmentIds, ...data } = parsed.data;

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

  try {
    const campaign = await db.$transaction(async (tx) => {
    // Enforce one active campaign constraint
    const activeCampaign = await tx.campaign.findFirst({
      where: { status: { in: [CampaignStatus.SENDING, CampaignStatus.QUEUED] } },
    });

    if (activeCampaign) {
      throw new Error("Another campaign is currently active. Only one campaign can be sending at a time.");
    }

    const created = await tx.campaign.create({
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        totalEmails: validRecipients.length,
        tags: tagIds.length > 0
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        attachments: attachmentIds.length > 0
          ? { create: attachmentIds.map((attachmentId) => ({ attachmentId })) }
          : undefined,
        queueItems: {
          create: validRecipients.map((c) => ({
            contactId: c.id,
          })),
        },
      },
      include: {
        smtpProfile: { select: { id: true, label: true, fromEmail: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { queueItems: true, attachments: true } },
      },
    });

    return created;
  });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred while creating the campaign.";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
