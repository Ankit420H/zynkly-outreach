import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderEmail } from "@/lib/templates/engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      template: true,
      queueItems: {
        include: { contact: true },
        take: 5,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const previews = campaign.queueItems.map((qi) => ({
    contactId: qi.contact.id,
    contactName: qi.contact.name,
    contactEmail: qi.contact.email,
    renderedHtml: renderEmail(campaign.template.content, qi.contact),
  }));

  return NextResponse.json({ previews, subject: campaign.name });
}
