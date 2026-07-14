// app/api/healthz/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: "unknown",
      redis: "unknown",
    },
  };

  // Check database
  try {
    await db.$queryRaw`SELECT 1`;
    health.checks.database = "healthy";
  } catch {
    health.checks.database = "unhealthy";
    health.status = "degraded";
  }

  // Check Redis
  try {
    await redis.ping();
    health.checks.redis = "healthy";
  } catch {
    health.checks.redis = "unhealthy";
    health.status = "degraded";
  }

  const statusCode = health.status === "healthy" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}