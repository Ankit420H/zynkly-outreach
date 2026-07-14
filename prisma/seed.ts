import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed tags
  const tags = await Promise.all([
    db.tag.upsert({ where: { name: "internship" }, create: { name: "internship" }, update: {} }),
    db.tag.upsert({ where: { name: "college-2024" }, create: { name: "college-2024" }, update: {} }),
    db.tag.upsert({ where: { name: "hr-recruitment" }, create: { name: "hr-recruitment" }, update: {} }),
  ]);

  console.log(`Seeded ${tags.length} tags`);

  // Seed a sample template
  const existing = await db.template.findFirst({ where: { name: "Welcome Email" } });
  if (!existing) {
    const template = await db.template.create({
      data: {
        name: "Welcome Email",
        content: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Welcome</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="margin: 0 0 16px;">Hi {{name}},</h2>
  <p style="margin: 0 0 16px; color: #374151;">
    We are excited to reach out to you from Zynkly. We noticed your profile from {{college}} 
    and believe you would be a great fit for our team.
  </p>
  <p style="margin: 0 0 16px; color: #374151;">
    We'd love to learn more about your background in {{branch}} and explore potential 
    opportunities together.
  </p>
  <a href="https://zynkly.com/apply" 
     style="display: inline-block; background: #111; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
    Learn More
  </a>
</body>
</html>`,
        versions: {
          create: { version: 1, content: "" },
        },
      },
    });
    // Update version content
    await db.templateVersion.updateMany({
      where: { templateId: template.id },
      data: { content: template.content },
    });
    console.log("Seeded sample template");
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
