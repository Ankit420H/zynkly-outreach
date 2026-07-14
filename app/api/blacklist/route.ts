import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blacklistSchema } from "@/lib/validations";

export async function GET() {
  const entries = await db.blacklistEntry.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = blacklistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const existing = await db.blacklistEntry.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    return NextResponse.json({ error: "Email already blacklisted" }, { status: 409 });
  }

  const entry = await db.blacklistEntry.create({ data: parsed.data });
  return NextResponse.json(entry, { status: 201 });
}
