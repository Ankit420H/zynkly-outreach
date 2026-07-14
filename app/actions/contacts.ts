"use server";

import { db } from "@/lib/db";
import { contactSchema, type ContactFormData } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function createContactAction(data: ContactFormData) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Validation failed" };
  }

  const { tagIds, ...contactData } = parsed.data;

  try {
    const contact = await db.contact.create({
      data: {
        ...contactData,
        tags: tagIds && tagIds.length > 0 ? {
          create: tagIds.map((tagId) => ({ tagId })),
        } : undefined,
      },
    });

    revalidatePath("/contacts");
    return { success: true, contact };
  } catch (error: unknown) {
    // Unique constraint on email
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { error: "A contact with this email already exists" };
    }
    return { error: "Failed to create contact" };
  }
}

export async function createTagAction(name: string) {
  if (!name.trim()) return { error: "Tag name cannot be empty" };

  try {
    const existing = await db.tag.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return { error: "Tag already exists" };
    }

    const tag = await db.tag.create({
      data: { name: name.trim() },
    });

    revalidatePath("/contacts");
    return { success: true, tag };
  } catch {
    return { error: "Failed to create tag" };
  }
}

export async function deleteContactAction(id: string) {
  try {
    await db.contact.delete({ where: { id } });
    revalidatePath("/contacts");
    return { success: true };
  } catch {
    return { error: "Failed to delete contact" };
  }
}
