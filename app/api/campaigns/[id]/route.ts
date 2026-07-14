import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CampaignStatus, QueueItemStatus } from "@prisma/client";
import { canTransition } from "@/lib/campaigns/lifecycle";
import { inngest } from "@/lib/inngest/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      smtpProfile: {
        select: { id: true, label: true, provider: true, fromName: true, fromEmail: true, isVerified: true },
      },
      template: true,
      attachments: { include: { attachment: true } },
      tags: true,
      queueItems: {
        include: { contact: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const stats = {
    pending: campaign.queueItems.filter((q) => q.status === QueueItemStatus.PENDING).length,
    queued: campaign.queueItems.filter((q) => q.status === QueueItemStatus.QUEUED).length,
    sending: campaign.queueItems.filter((q) => q.status === QueueItemStatus.SENDING).length,
    sent: campaign.queueItems.filter((q) => q.status === QueueItemStatus.SENT).length,
    failed: campaign.queueItems.filter((q) => q.status === QueueItemStatus.FAILED).length,
    retrying: campaign.queueItems.filter((q) => q.status === QueueItemStatus.RETRYING).length,
    cancelled: campaign.queueItems.filter((q) => q.status === QueueItemStatus.CANCELLED).length,
  };

  return NextResponse.json({ ...campaign, stats });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status: newStatus } = body as { status: CampaignStatus };

  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (!canTransition(campaign.status, newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${campaign.status} to ${newStatus}` },
      { status: 400 }
    );
  }

  // Enforce one active campaign
  if (newStatus === CampaignStatus.QUEUED || newStatus === CampaignStatus.SENDING) {
    const activeCampaign = await db.campaign.findFirst({
      where: {
        id: { not: id },
        status: { in: [CampaignStatus.SENDING, CampaignStatus.QUEUED] },
      },
    });

    if (activeCampaign) {
      return NextResponse.json(
        { error: "Another campaign is currently active" },
        { status: 409 }
      );
    }
  }

  const updated = await db.campaign.update({
    where: { id },
    data: { status: newStatus },
  });

  // Trigger background job for QUEUED state
  if (newStatus === CampaignStatus.QUEUED) {
    await db.queueItem.updateMany({
      where: { campaignId: id, status: QueueItemStatus.PENDING },
      data: { status: QueueItemStatus.QUEUED },
    });

    await inngest.send({
      name: "campaign/send",
      data: { campaignId: id },
    });
  }

  // Resume from pause
  if (newStatus === CampaignStatus.SENDING && campaign.status === CampaignStatus.PAUSED) {
    await inngest.send({
      name: "campaign/resume",
      data: { campaignId: id },
    });
  }

  // Auto-archive completed
  if (newStatus === CampaignStatus.COMPLETED) {
    await db.campaign.update({
      where: { id },
      data: { status: CampaignStatus.ARCHIVED, completedAt: new Date() },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id } });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status === CampaignStatus.SENDING) {
    return NextResponse.json({ error: "Cannot delete an active campaign" }, { status: 400 });
  }

  await db.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
