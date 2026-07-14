import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tagSchema } from "@/lib/validations";

export async function GET() {
  const tags = await db.tag.findMany({
    include: { _count: { select: { contacts: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const existing = await db.tag.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
  }

  const tag = await db.tag.create({ data: parsed.data });
  return NextResponse.json(tag, { status: 201 });
}
