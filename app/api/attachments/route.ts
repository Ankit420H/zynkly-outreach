import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "image/png",
  "image/jpeg",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET() {
  const attachments = await db.attachment.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(attachments);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type ${file.type} not allowed. Allowed: PDF, DOCX, PPTX, ZIP, PNG, JPG` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
  }

  const blob = await put(`attachments/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  const attachment = await db.attachment.create({
    data: {
      filename: file.name,
      url: blob.url,
      mimeType: file.type,
      size: file.size,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
