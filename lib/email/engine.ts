import nodemailer from "nodemailer";
import type { SmtpProfile } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

export function createTransport(profile: SmtpProfile): nodemailer.Transporter {
  const password = decrypt(profile.encryptedPassword);

  return nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.secure,
    auth: {
      user: profile.username,
      pass: password,
    },
  });
}

export async function testConnection(profile: SmtpProfile): Promise<{ success: boolean; error?: string }> {
  try {
    const transport = createTransport(profile);
    await transport.verify();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("SMTP connection test failed", "smtp", { profileId: profile.id, error: message });
    return { success: false, error: message };
  }
}

interface SendEmailOptions {
  profile: SmtpProfile;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; path: string }[];
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = createTransport(options.profile);

    const result = await transport.sendMail({
      from: `"${options.profile.fromName}" <${options.profile.fromEmail}>`,
      replyTo: options.profile.replyTo || undefined,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        path: a.path,
      })),
    });

    logger.info("Email sent successfully", "email", {
      to: options.to,
      messageId: result.messageId,
    });

    return { success: true, messageId: result.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Email send failed", "email", {
      to: options.to,
      error: message,
    });
    return { success: false, error: message };
  }
}
