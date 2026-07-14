import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smtpProfileSchema } from "@/lib/validations";
import { encrypt } from "@/lib/encryption";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await db.smtpProfile.findUnique({
    where: { id },
    select: {
      id: true, label: true, provider: true, host: true, port: true,
      username: true, secure: true, fromName: true, fromEmail: true,
      replyTo: true, isVerified: true, lastTestedAt: true,
      createdAt: true, updatedAt: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "SMTP profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = smtpProfileSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const { password, ...data } = parsed.data;
  const updateData: Record<string, unknown> = { ...data };

  if (password) {
    updateData.encryptedPassword = encrypt(password);
  }

  const profile = await db.smtpProfile.update({
    where: { id },
    data: updateData,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedPassword: _, ...safeProfile } = profile;
  return NextResponse.json(safeProfile);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.smtpProfile.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
