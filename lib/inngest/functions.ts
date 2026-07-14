import { inngest } from "./client";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/engine";
import { renderEmail } from "@/lib/templates/engine";
import { redis, CACHE_KEYS } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { CampaignStatus, QueueItemStatus, type Contact, type SmtpProfile } from "@prisma/client";
import pLimit from "p-limit";

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [5000, 15000, 45000];

export const sendCampaign = inngest.createFunction(
  {
    id: "send-campaign",
    name: "Send Campaign Emails",
    retries: 0,
    concurrency: [{ limit: 1, key: "event.data.campaignId" }],
  },
  { event: "campaign/send" },
  async ({ event, step }) => {
    const { campaignId } = event.data;

    const campaign = await step.run("load-campaign", async () => {
      const c = await db.campaign.findUnique({
        where: { id: campaignId },
        include: {
          smtpProfile: true,
          template: true,
          attachments: { include: { attachment: true } },
        },
      });
      if (!c) throw new Error(`Campaign ${campaignId} not found`);
      return c;
    });

    await step.run("mark-sending", async () => {
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.SENDING, startedAt: new Date() },
      });
      await redis.set(CACHE_KEYS.activeCampaign, campaignId);
    });

    const queueItems = await step.run("load-queue", async () => {
      return db.queueItem.findMany({
        where: {
          campaignId,
          status: { in: [QueueItemStatus.PENDING, QueueItemStatus.QUEUED, QueueItemStatus.RETRYING] },
        },
        include: { contact: true },
        orderBy: { createdAt: "asc" },
      });
    });

    const BATCH_SIZE = 50;
    const CONCURRENCY = 10;

    for (let i = 0; i < queueItems.length; i += BATCH_SIZE) {
      const batch = queueItems.slice(i, i + BATCH_SIZE);

      const paused = await step.run(`check-pause-batch-${i}`, async () => {
        const current = await db.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });
        return current?.status === CampaignStatus.PAUSED;
      });

      if (paused) {
        logger.info("Campaign paused, stopping processing", "campaign", { campaignId });
        return { status: "paused" };
      }

      await step.run(`process-batch-${i}`, async () => {
        const limit = pLimit(CONCURRENCY);

        await Promise.all(batch.map((item) => limit(async () => {
          await db.queueItem.update({
            where: { id: item.id },
            data: { status: QueueItemStatus.SENDING },
          });

          const html = renderEmail(campaign.template.content, item.contact as unknown as Contact);

          const attachments = campaign.attachments.map((ca) => ({
            filename: ca.attachment.filename,
            path: ca.attachment.url,
          }));

          const result = await sendEmail({
            profile: campaign.smtpProfile as unknown as SmtpProfile,
            to: item.contact.email,
            subject: campaign.name,
            html,
            attachments,
          });

          if (result.success) {
            await db.queueItem.update({
              where: { id: item.id },
              data: {
                status: QueueItemStatus.SENT,
                sentAt: new Date(),
                attempts: item.attempts + 1,
              },
            });
          } else {
            const newAttempts = item.attempts + 1;
            const shouldRetry = newAttempts < MAX_RETRIES;

            await db.queueItem.update({
              where: { id: item.id },
              data: {
                status: shouldRetry ? QueueItemStatus.RETRYING : QueueItemStatus.FAILED,
                lastError: result.error,
                attempts: newAttempts,
              },
            });
          }
        })));

        // Update progress in Redis after each batch
        const currentSent = await db.queueItem.count({
          where: { campaignId, status: QueueItemStatus.SENT },
        });
        const currentFailed = await db.queueItem.count({
          where: { campaignId, status: QueueItemStatus.FAILED },
        });
        
        await db.campaign.update({
          where: { id: campaignId },
          data: { sentEmails: currentSent, failedEmails: currentFailed },
        });

        await redis.set(CACHE_KEYS.campaignProgress(campaignId), JSON.stringify({
          sent: currentSent,
          failed: currentFailed,
          total: campaign.totalEmails,
          current: Math.min(i + BATCH_SIZE, queueItems.length),
        }));
      });

      if (i + BATCH_SIZE < queueItems.length && campaign.delaySeconds > 0) {
        await step.sleep(`delay-batch-${i}`, `${campaign.delaySeconds}s`);
      }
    }

    const retryItems = await step.run("check-retries", async () => {
      return db.queueItem.findMany({
        where: { campaignId, status: QueueItemStatus.RETRYING },
        include: { contact: true },
      });
    });

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < retryItems.length; i++) {
      const item = retryItems[i];
      const retryIndex = item.attempts - 1;
      const backoff = RETRY_BACKOFF_MS[retryIndex] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];

      await step.sleep(`retry-backoff-${item.id}`, `${backoff}ms`);

      await step.run(`retry-send-${item.id}`, async () => {
        const html = renderEmail(campaign.template.content, item.contact as unknown as Contact);
        const attachments = campaign.attachments.map((ca) => ({
          filename: ca.attachment.filename,
          path: ca.attachment.url,
        }));

        const result = await sendEmail({
          profile: campaign.smtpProfile as unknown as SmtpProfile,
          to: item.contact.email,
          subject: campaign.name,
          html,
          attachments,
        });

        const newAttempts = item.attempts + 1;

        if (result.success) {
          await db.queueItem.update({
            where: { id: item.id },
            data: { status: QueueItemStatus.SENT, sentAt: new Date(), attempts: newAttempts },
          });
          sentCount++;
        } else {
          const shouldRetry = newAttempts < MAX_RETRIES;
          await db.queueItem.update({
            where: { id: item.id },
            data: {
              status: shouldRetry ? QueueItemStatus.RETRYING : QueueItemStatus.FAILED,
              lastError: result.error,
              attempts: newAttempts,
            },
          });
          if (!shouldRetry) failedCount++;
        }

        await db.campaign.update({
          where: { id: campaignId },
          data: { sentEmails: sentCount, failedEmails: failedCount },
        });
      });
    }

    await step.run("mark-completed", async () => {
      const finalStats = await db.queueItem.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
      });

      const finalSent = finalStats.find((s) => s.status === QueueItemStatus.SENT)?._count || 0;
      const finalFailed = finalStats.find((s) => s.status === QueueItemStatus.FAILED)?._count || 0;

      await db.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.COMPLETED,
          completedAt: new Date(),
          sentEmails: finalSent,
          failedEmails: finalFailed,
        },
      });
      await redis.del(CACHE_KEYS.activeCampaign);
      await redis.del(CACHE_KEYS.campaignProgress(campaignId));

      logger.info("Campaign completed", "campaign", {
        campaignId,
        sent: finalSent,
        failed: finalFailed,
        total: campaign.totalEmails,
      });
    });

    await step.run("send-notification", async () => {
      const notificationEmail = process.env.NOTIFICATION_EMAIL;
      if (!notificationEmail) return;

      const finalCampaign = await db.campaign.findUnique({
        where: { id: campaignId },
        include: { smtpProfile: true },
      });
      if (!finalCampaign) return;

      await sendEmail({
        profile: finalCampaign.smtpProfile as unknown as SmtpProfile,
        to: notificationEmail,
        subject: `Campaign "${finalCampaign.name}" Completed`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="margin: 0 0 16px;">Campaign Summary</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Campaign</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${finalCampaign.name}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${finalCampaign.totalEmails}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Sent</td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #059669;">${finalCampaign.sentEmails}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Failed</td><td style="padding: 8px 0; font-weight: 600; color: ${finalCampaign.failedEmails > 0 ? '#dc2626' : '#059669'};">${finalCampaign.failedEmails}</td></tr>
            </table>
            <p style="margin: 16px 0 0; font-size: 13px; color: #9ca3af;">Completed at ${new Date().toLocaleString()}</p>
          </div>
        `,
      });
    });

    return { status: "completed" };
  }
);

export const resumeCampaign = inngest.createFunction(
  {
    id: "resume-campaign",
    name: "Resume Paused Campaign",
    retries: 0,
  },
  { event: "campaign/resume" },
  async ({ event }) => {
    const { campaignId } = event.data;
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.SENDING },
    });

    await inngest.send({
      name: "campaign/send",
      data: { campaignId },
    });

    return { status: "resumed" };
  }
);

export const functions = [sendCampaign, resumeCampaign];
