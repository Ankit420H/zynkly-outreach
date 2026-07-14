import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache keys
export const CACHE_KEYS = {
  campaignProgress: (id: string) => `campaign:${id}:progress`,
  activeCampaign: "campaign:active",
  dashboardStats: "dashboard:stats",
  queueStatus: (campaignId: string) => `queue:${campaignId}:status`,
} as const;
