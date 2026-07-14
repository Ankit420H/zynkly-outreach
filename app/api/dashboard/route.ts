import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis, CACHE_KEYS } from "@/lib/redis";
import { CampaignStatus, QueueItemStatus } from "@prisma/client";

export async function GET() {
  const [
    totalContacts,
    totalCampaigns,
    activeCampaign,
    recentCampaigns,
    queueStats,
    smtpProfiles,
  ] = await Promise.all([
    db.contact.count(),
    db.campaign.count(),
    db.campaign.findFirst({
      where: { status: { in: [CampaignStatus.SENDING, CampaignStatus.QUEUED] } },
      include: {
        smtpProfile: { select: { label: true, fromEmail: true } },
        template: { select: { name: true } },
      },
    }),
    db.campaign.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        totalEmails: true,
        sentEmails: true,
        failedEmails: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    db.queueItem.groupBy({
      by: ["status"],
      _count: true,
    }),
    db.smtpProfile.findMany({
      where: { isVerified: true },
      select: { id: true, label: true, fromEmail: true },
      take: 1,
    }),
  ]);

  const queueStatsMap = Object.fromEntries(
    queueStats.map((s) => [s.status, s._count])
  );

  let activeProgress = null;
  if (activeCampaign) {
    const cached = await redis.get(CACHE_KEYS.campaignProgress(activeCampaign.id));
    if (cached) {
      activeProgress = typeof cached === "string" ? JSON.parse(cached) : cached;
    } else {
      activeProgress = {
        sent: activeCampaign.sentEmails,
        failed: activeCampaign.failedEmails,
        total: activeCampaign.totalEmails,
        current: activeCampaign.sentEmails + activeCampaign.failedEmails,
      };
    }
  }

  return NextResponse.json({
    totalContacts,
    totalCampaigns,
    activeCampaign: activeCampaign
      ? {
          id: activeCampaign.id,
          name: activeCampaign.name,
          status: activeCampaign.status,
          smtpProfile: activeCampaign.smtpProfile,
          template: activeCampaign.template,
          progress: activeProgress,
        }
      : null,
    recentCampaigns,
    queueStats: {
      pending: queueStatsMap[QueueItemStatus.PENDING] || 0,
      queued: queueStatsMap[QueueItemStatus.QUEUED] || 0,
      sending: queueStatsMap[QueueItemStatus.SENDING] || 0,
      sent: queueStatsMap[QueueItemStatus.SENT] || 0,
      failed: queueStatsMap[QueueItemStatus.FAILED] || 0,
      retrying: queueStatsMap[QueueItemStatus.RETRYING] || 0,
    },
    activeSmtpProfile: smtpProfiles[0] || null,
    totalEmailsSent: queueStatsMap[QueueItemStatus.SENT] || 0,
    totalEmailsFailed: queueStatsMap[QueueItemStatus.FAILED] || 0,
    totalEmailsPending:
      (queueStatsMap[QueueItemStatus.PENDING] || 0) +
      (queueStatsMap[QueueItemStatus.QUEUED] || 0),
  });
}
