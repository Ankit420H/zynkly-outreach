import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { templateSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";

  const where = search
    ? { name: { contains: search, mode: "insensitive" as const } }
    : {};

  const templates = await db.template.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { versions: true } } },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const template = await db.$transaction(async (tx) => {
    const t = await tx.template.create({ data: parsed.data });
    await tx.templateVersion.create({
      data: { templateId: t.id, content: parsed.data.content, version: 1 },
    });
    return t;
  });

  return NextResponse.json(template, { status: 201 });
}
