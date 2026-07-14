import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [contacts, campaigns, templates, attachments, smtpProfiles, tags] = await Promise.all([
    db.contact.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { college: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true },
    }),
    db.campaign.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true, status: true },
    }),
    db.template.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true },
    }),
    db.attachment.findMany({
      where: { filename: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, filename: true },
    }),
    db.smtpProfile.findMany({
      where: {
        OR: [
          { label: { contains: q, mode: "insensitive" } },
          { fromEmail: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, label: true },
    }),
    db.tag.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true },
    }),
  ]);

  const results = [
    ...contacts.map((c) => ({ type: "contact" as const, id: c.id, title: c.name, subtitle: c.email, href: `/contacts/${c.id}` })),
    ...campaigns.map((c) => ({ type: "campaign" as const, id: c.id, title: c.name, subtitle: c.status, href: `/campaigns/${c.id}` })),
    ...templates.map((t) => ({ type: "template" as const, id: t.id, title: t.name, subtitle: "Template", href: `/templates/${t.id}` })),
    ...attachments.map((a) => ({ type: "attachment" as const, id: a.id, title: a.filename, subtitle: "Attachment", href: `/attachments` })),
    ...smtpProfiles.map((s) => ({ type: "smtp" as const, id: s.id, title: s.label, subtitle: "SMTP Profile", href: `/smtp` })),
    ...tags.map((t) => ({ type: "tag" as const, id: t.id, title: t.name, subtitle: "Tag", href: `/contacts?tagId=${t.id}` })),
  ];

  return NextResponse.json({ results });
}
