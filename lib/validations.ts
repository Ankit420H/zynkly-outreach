import { z } from "zod";

// =============================================================================
// Contact
// =============================================================================

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  phone: z.string().trim().optional().default(""),
  whatsapp: z.string().trim().optional().default(""),
  college: z.string().trim().optional().default(""),
  year: z.string().trim().optional().default(""),
  branch: z.string().trim().optional().default(""),
  department: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  state: z.string().trim().optional().default(""),
  skills: z.string().trim().optional().default(""),
  resumeUrl: z.string().url().optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  source: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  customFields: z.record(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

export type ContactFormData = z.infer<typeof contactSchema>;

export const contactImportRowSchema = z.object({
  name: z.string().min(1).trim(),
  email: z.string().email().trim().toLowerCase(),
  phone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  college: z.string().trim().optional(),
  year: z.string().trim().optional(),
  branch: z.string().trim().optional(),
  department: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  skills: z.string().trim().optional(),
  resumeUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  source: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

// =============================================================================
// Tag
// =============================================================================

export const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required").trim(),
});

export type TagFormData = z.infer<typeof tagSchema>;

// =============================================================================
// Template
// =============================================================================

export const templateSchema = z.object({
  name: z.string().min(1, "Template name is required").trim(),
  content: z.string().min(1, "Template content is required"),
});

export type TemplateFormData = z.infer<typeof templateSchema>;

// =============================================================================
// SMTP Profile
// =============================================================================

export const smtpProfileSchema = z.object({
  label: z.string().min(1, "Label is required").trim(),
  provider: z.enum(["gmail", "zoho", "outlook", "brevo", "ses", "custom"]),
  host: z.string().min(1, "Host is required").trim(),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().min(1, "Username is required").trim(),
  password: z.string().min(1, "Password is required"),
  secure: z.boolean().default(true),
  fromName: z.string().min(1, "From name is required").trim(),
  fromEmail: z.string().email("Invalid from email").trim(),
  replyTo: z.string().email("Invalid reply-to email").optional().or(z.literal("")),
});

export type SmtpProfileFormData = z.infer<typeof smtpProfileSchema>;

// =============================================================================
// Campaign
// =============================================================================

export const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").trim(),
  smtpProfileId: z.string().min(1, "SMTP profile is required"),
  templateId: z.string().min(1, "Template is required"),
  delaySeconds: z.coerce.number().int().min(1).max(3600).default(5),
  scheduledAt: z.string().datetime().optional().nullable(),
  contactIds: z.array(z.string()).optional().default([]),
  tagIds: z.array(z.string()).optional().default([]),
  attachmentIds: z.array(z.string()).optional().default([]),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

// =============================================================================
// Blacklist
// =============================================================================

export const blacklistSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  reason: z.string().trim().optional().default(""),
});

export type BlacklistFormData = z.infer<typeof blacklistSchema>;

// =============================================================================
// Login
// =============================================================================

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
