// app/api/readyz/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const checks = {
    database: false,
    migrations: false,
  };

  // Check database connectivity and migration status
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
    
    // Check if migrations are up to date
    const result = await db.$queryRaw`
      SELECT COUNT(*) as count FROM _prisma_migrations 
      WHERE finished_at IS NOT NULL
    ` as [{ count: bigint }];
    checks.migrations = result[0]?.count > 0;
  } catch {
    // Database not ready
  }

  const isReady = checks.database && checks.migrations;
  
  return NextResponse.json(
    {
      status: isReady ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: isReady ? 200 : 503 }
  );
}