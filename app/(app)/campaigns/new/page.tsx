"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Check, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Step = "basics" | "recipients" | "validate";

const STEPS: Step[] = ["basics", "recipients", "validate"];
const STEP_LABELS = { basics: "Basics", recipients: "Audience", validate: "Validate & Send" };

interface SmtpProfile { id: string; label: string; fromEmail: string; isVerified: boolean; }
interface Template { id: string; name: string; }
interface Attachment { id: string; filename: string; mimeType: string; }
interface Tag { id: string; name: string; _count: { contacts: number }; }

interface DryRunResult {
  passed: boolean;
  issues: { type: "error" | "warning"; message: string }[];
  recipientCount: number;
  estimatedMinutes: number;
  estimatedSeconds: number;
}

interface FormData {
  name: string;
  smtpProfileId: string;
  templateId: string;
  delaySeconds: number;
  scheduledAt: string;
  contactIds: string[];
  tagIds: string[];
  attachmentIds: string[];
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [creating, setCreating] = useState(false);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    smtpProfileId: "",
    templateId: "",
    delaySeconds: 5,
    scheduledAt: "",
    contactIds: [],
    tagIds: [],
    attachmentIds: [],
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/smtp").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/attachments").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([smtp, tmpl, attach, tgs]) => {
      setSmtpProfiles(smtp);
      setTemplates(tmpl);
      setAttachments(attach);
      setTags(tgs);
    });
  }, []);

  function toggleTag(id: string) {
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((t) => t !== id) : [...prev.tagIds, id],
    }));
  }

  function toggleAttachment(id: string) {
    setFormData((prev) => ({
      ...prev,
      attachmentIds: prev.attachmentIds.includes(id)
        ? prev.attachmentIds.filter((a) => a !== id)
        : [...prev.attachmentIds, id],
    }));
  }

  const stepIndex = STEPS.indexOf(step);

  const canNext = () => {
    if (step === "basics") return formData.name.trim().length > 0;
    if (step === "recipients") return true;
    if (step === "validate") return formData.smtpProfileId && formData.templateId;
    return true;
  };

  const selectedSmtp = smtpProfiles.find((p) => p.id === formData.smtpProfileId);
  const selectedTemplate = templates.find((t) => t.id === formData.templateId);

  const totalRecipients = formData.tagIds.reduce((sum, tid) => {
    const tag = tags.find((t) => t.id === tid);
    return sum + (tag?._count.contacts || 0);
  }, 0);

  async function runDryRun() {
    if (!formData.smtpProfileId || !formData.templateId) return;
    setRunningDryRun(true);
    setDryRunResult(null);

    try {
      const res = await fetch("/api/campaigns/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          smtpProfileId: formData.smtpProfileId,
          templateId: formData.templateId,
          delaySeconds: formData.delaySeconds,
          scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
          contactIds: formData.contactIds,
          tagIds: formData.tagIds,
          attachmentIds: formData.attachmentIds,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setDryRunResult(result);
        if (result.passed) {
          toast.success("Validation passed — campaign is ready to send");
        } else {
          toast.error("Validation found issues");
        }
      } else {
        const err = await res.json();
        toast.error(err.error?.message || "Validation failed");
      }
    } finally {
      setRunningDryRun(false);
    }
  }

  async function createCampaign() {
    if (!formData.smtpProfileId || !formData.templateId) return;
    setCreating(true);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
        }),
      });

      if (res.ok) {
        const campaign = await res.json();
        toast.success("Campaign created");
        router.push(`/campaigns/${campaign.id}`);
      } else {
        const err = await res.json();
        const message = err.error?.message || "Failed to create campaign";
        toast.error(message);
      }
    } finally {
      setCreating(false);
    }
  }

  // Auto-run dry run when entering validate step
  useEffect(() => {
    if (step === "validate" && !dryRunResult && formData.smtpProfileId && formData.templateId) {
      const handleRunDryRun = async () => {
        await runDryRun();
      };
      
      handleRunDryRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formData.smtpProfileId, formData.templateId, dryRunResult]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">New Campaign</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors
                ${i < stepIndex ? "bg-primary text-primary-foreground" : i === stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:block ${i === stepIndex ? "font-medium" : "text-muted-foreground"}`}>
              {STEP_LABELS[s]}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step: Basics */}
      {step === "basics" && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name (= Email Subject)</Label>
              <Input
                id="campaign-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Internship Opportunity at Zynkly"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delay">Delay Between Emails (seconds)</Label>
              <Input
                id="delay"
                type="number"
                min={1}
                max={3600}
                value={formData.delaySeconds}
                onChange={(e) => setFormData((prev) => ({ ...prev, delaySeconds: parseInt(e.target.value) || 5 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule At (optional)</Label>
              <Input
                id="schedule"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData((prev) => ({ ...prev, scheduledAt: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Recipients */}
      {step === "recipients" && (
        <Card>
          <CardHeader>
            <CardTitle>Select Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags created yet. All contacts will be included.</p>
            ) : (
              <div className="space-y-3">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={formData.tagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                    />
                    <Label htmlFor={`tag-${tag.id}`} className="cursor-pointer flex items-center gap-2">
                      {tag.name}
                      <Badge variant="secondary" className="text-xs">{tag._count.contacts} contacts</Badge>
                    </Label>
                  </div>
                ))}
              </div>
            )}
            {formData.tagIds.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                No tags selected — all contacts will receive this campaign.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Content & Validate */}
      {step === "validate" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.smtpProfileId}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, smtpProfileId: v as string }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose SMTP profile..." />
                </SelectTrigger>
                <SelectContent>
                  {smtpProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} — {p.fromEmail} {!p.isVerified && "⚠️ Unverified"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Template</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={formData.templateId}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, templateId: v as string }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`att-${a.id}`}
                        checked={formData.attachmentIds.includes(a.id)}
                        onCheckedChange={() => toggleAttachment(a.id)}
                      />
                      <Label htmlFor={`att-${a.id}`} className="cursor-pointer">{a.filename}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dry Run Results */}
          <Card className={dryRunResult?.passed ? "border-green-200" : "border-destructive/50"}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Pre-Flight Validation</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={runDryRun}
                disabled={runningDryRun || !formData.smtpProfileId || !formData.templateId}
              >
                {runningDryRun ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Loader2 className="mr-2 h-4 w-4" /> Re-run
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {dryRunResult === null ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
                  <p>Running validation checks...</p>
                </div>
              ) : dryRunResult.passed ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">All checks passed</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Recipients:</span> {dryRunResult.recipientCount}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estimated time:</span> ~{dryRunResult.estimatedMinutes} min
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click &quot;Create &amp; Send&quot; to queue this campaign.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Validation failed</span>
                  </div>
                  <div className="space-y-2">
                    {dryRunResult.issues.map((issue, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-3 rounded-md text-sm ${
                          issue.type === "error"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                        }`}
                      >
                        {issue.type === "error" ? <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                        {escapeHtml(issue.message)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">Name:</div>
                <div className="font-medium">{formData.name}</div>
                <div className="text-muted-foreground">SMTP:</div>
                <div>{selectedSmtp?.label || "Not selected"}</div>
                <div className="text-muted-foreground">Template:</div>
                <div>{selectedTemplate?.name || "Not selected"}</div>
                <div className="text-muted-foreground">Delay:</div>
                <div>{formData.delaySeconds}s between emails</div>
                <div className="text-muted-foreground">Recipients:</div>
                <div>
                  {formData.tagIds.length === 0
                    ? "All contacts"
                    : `${formData.tagIds.length} tag(s) selected (~${totalRecipients} contacts)`}
                </div>
                <div className="text-muted-foreground">Attachments:</div>
                <div>{formData.attachmentIds.length} file(s)</div>
                {formData.scheduledAt && (
                  <>
                    <div className="text-muted-foreground">Scheduled:</div>
                    <div>{new Date(formData.scheduledAt).toLocaleString()}</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(STEPS[stepIndex - 1])}
          disabled={stepIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step !== "validate" ? (
          <Button onClick={() => setStep(STEPS[stepIndex + 1])} disabled={!canNext()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={createCampaign}
            disabled={creating || !dryRunResult?.passed || !formData.smtpProfileId || !formData.templateId}
            className="w-full sm:w-auto"
          >
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dryRunResult?.passed ? "Create & Send" : "Fix Issues First"}
          </Button>
        )}
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}