import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSchema } from "@/lib/validations";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const tagId = searchParams.get("tagId") || "";
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { college: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  if (tagId) {
    where.tags = { some: { tagId } };
  }

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      include: { tags: { include: { tag: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.contact.count({ where }),
  ]);

  return NextResponse.json({
    contacts,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (Array.isArray(body)) {
    const importSchema = z.array(contactSchema);
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
    }

    const results = await db.$transaction(async (tx) => {
      const created = [];
      for (const contact of parsed.data) {
        const { tagIds, ...data } = contact;
        const existing = await tx.contact.findUnique({ where: { email: data.email } });
        if (existing) continue;

        const newContact = await tx.contact.create({
          data: {
            ...data,
            tags: tagIds?.length
              ? { create: tagIds.map((tagId) => ({ tagId })) }
              : undefined,
          },
        });
        created.push(newContact);
      }
      return created;
    });

    return NextResponse.json({ created: results.length }, { status: 201 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
  }

  const { tagIds, ...data } = parsed.data;
  const existing = await db.contact.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json({ error: "Contact with this email already exists" }, { status: 409 });
  }

  const contact = await db.contact.create({
    data: {
      ...data,
      tags: tagIds?.length
        ? { create: tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: { tags: { include: { tag: true } } },
  });

  return NextResponse.json(contact, { status: 201 });
}
