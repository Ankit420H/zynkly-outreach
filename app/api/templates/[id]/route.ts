import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { templateSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await db.template.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = templateSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const template = await db.$transaction(async (tx) => {
    const updated = await tx.template.update({
      where: { id },
      data: parsed.data,
    });

    if (parsed.data.content) {
      const latestVersion = await tx.templateVersion.findFirst({
        where: { templateId: id },
        orderBy: { version: "desc" },
      });

      await tx.templateVersion.create({
        data: {
          templateId: id,
          content: parsed.data.content,
          version: (latestVersion?.version || 0) + 1,
        },
      });
    }

    return updated;
  });

  return NextResponse.json(template);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.template.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
