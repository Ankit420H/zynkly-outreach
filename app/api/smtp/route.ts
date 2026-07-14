import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smtpProfileSchema } from "@/lib/validations";
import { encrypt } from "@/lib/encryption";
import { testConnection } from "@/lib/email/engine";

export async function GET() {
  const profiles = await db.smtpProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      provider: true,
      host: true,
      port: true,
      username: true,
      secure: true,
      fromName: true,
      fromEmail: true,
      replyTo: true,
      isVerified: true,
      lastTestedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(profiles);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = smtpProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const { password, ...data } = parsed.data;
  const encryptedPassword = encrypt(password);

  const profile = await db.smtpProfile.create({
    data: {
      ...data,
      encryptedPassword,
    },
  });

  const testResult = await testConnection(profile);

  await db.smtpProfile.update({
    where: { id: profile.id },
    data: {
      isVerified: testResult.success,
      lastTestedAt: new Date(),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedPassword: _, ...safeProfile } = profile;
  return NextResponse.json(
    { ...safeProfile, isVerified: testResult.success, testResult },
    { status: 201 }
  );
}
