import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testConnection } from "@/lib/email/engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await db.smtpProfile.findUnique({ where: { id } });

  if (!profile) {
    return NextResponse.json({ error: "SMTP profile not found" }, { status: 404 });
  }

  const result = await testConnection(profile);

  await db.smtpProfile.update({
    where: { id },
    data: {
      isVerified: result.success,
      lastTestedAt: new Date(),
    },
  });

  return NextResponse.json(result);
}
