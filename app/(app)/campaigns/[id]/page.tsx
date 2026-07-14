"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, PlayCircle, PauseCircle, ArchiveIcon,
  FlaskConical, Eye, Loader2, CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/campaigns/lifecycle";
import { cn } from "@/lib/utils";
import type { CampaignStatus, QueueItemStatus } from "@prisma/client";

interface CampaignDetail {
  id: string;
  name: string;
  status: CampaignStatus;
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  delaySeconds: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  smtpProfile: { id: string; label: string; provider: string; fromName: string; fromEmail: string; isVerified: boolean };
  template: { id: string; name: string; content: string };
  attachments: { attachment: { id: string; filename: string; size: number } }[];
  queueItems: { id: string; status: QueueItemStatus; sentAt: string | null; lastError: string | null; contact: { id: string; name: string; email: string } }[];
  stats: Record<string, number>;
}

interface DryRunResult {
  passed: boolean;
  issues: { type: "error" | "warning"; message: string }[];
  recipientCount: number;
  estimatedMinutes: number;
}

interface SandboxPreview {
  contactId: string;
  contactName: string;
  contactEmail: string;
  renderedHtml: string;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [sandboxPreviews, setSandboxPreviews] = useState<SandboxPreview[]>([]);
  const [activeSandbox, setActiveSandbox] = useState(0);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [loadingSandbox, setLoadingSandbox] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  async function fetchCampaign() {
    const res = await fetch(`/api/campaigns/${id}`);
    if (res.ok) { setCampaign(await res.json()); setLoading(false); }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCampaign();
    const interval = setInterval(fetchCampaign, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runDryRun() {
    setRunningDryRun(true);
    const res = await fetch(`/api/campaigns/${id}/dry-run`, { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      setDryRunResult(result);
      if (result.passed) {
        toast.success("Dry run passed — campaign is ready");
        fetchCampaign();
      } else {
        toast.error("Dry run found issues");
      }
    }
    setRunningDryRun(false);
  }

  async function loadSandbox() {
    setLoadingSandbox(true);
    const res = await fetch(`/api/campaigns/${id}/sandbox`);
    if (res.ok) {
      const data = await res.json();
      setSandboxPreviews(data.previews);
    }
    setLoadingSandbox(false);
  }

  async function transition(status: CampaignStatus) {
    setTransitioning(true);
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Campaign ${STATUS_LABELS[status]}`);
      fetchCampaign();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed");
    }
    setTransitioning(false);
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-64" /><div className="h-48 bg-muted rounded" /></div>;
  if (!campaign) return <p className="text-muted-foreground">Campaign not found</p>;

  const progress = campaign.totalEmails > 0
    ? Math.round(((campaign.sentEmails + campaign.failedEmails) / campaign.totalEmails) * 100)
    : 0;

  const QUEUE_STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    QUEUED: "bg-blue-100 text-blue-700",
    SENDING: "bg-yellow-100 text-yellow-700",
    SENT: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    RETRYING: "bg-orange-100 text-orange-700",
    CANCELLED: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            <Badge className={cn(STATUS_COLORS[campaign.status])}>
              {STATUS_LABELS[campaign.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {campaign.smtpProfile.label} · {campaign.template.name} · {campaign.totalEmails} recipients
          </p>
        </div>
        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap justify-end">
          {campaign.status === "DRAFT" && (
            <Button onClick={runDryRun} disabled={runningDryRun} variant="outline">
              {runningDryRun ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              Dry Run
            </Button>
          )}
          {campaign.status === "READY" && (
            <>
              <Button variant="outline" onClick={loadSandbox} disabled={loadingSandbox}>
                {loadingSandbox ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Sandbox
              </Button>
              <Button onClick={() => transition("QUEUED" as CampaignStatus)} disabled={transitioning}>
                <PlayCircle className="mr-2 h-4 w-4" />Start Sending
              </Button>
            </>
          )}
          {campaign.status === "SENDING" && (
            <Button variant="outline" onClick={() => transition("PAUSED" as CampaignStatus)} disabled={transitioning}>
              <PauseCircle className="mr-2 h-4 w-4" />Pause
            </Button>
          )}
          {campaign.status === "PAUSED" && (
            <Button onClick={() => transition("SENDING" as CampaignStatus)} disabled={transitioning}>
              <PlayCircle className="mr-2 h-4 w-4" />Resume
            </Button>
          )}
          {campaign.status === "COMPLETED" && (
            <Button variant="ghost" onClick={() => transition("ARCHIVED" as CampaignStatus)} disabled={transitioning}>
              <ArchiveIcon className="mr-2 h-4 w-4" />Archive
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {campaign.totalEmails > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { label: "Total", value: campaign.totalEmails, color: "" },
                { label: "Sent", value: campaign.sentEmails, color: "text-green-600" },
                { label: "Failed", value: campaign.failedEmails, color: "text-red-600" },
                { label: "Pending", value: campaign.totalEmails - campaign.sentEmails - campaign.failedEmails, color: "text-muted-foreground" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="queue">Queue ({campaign.queueItems.length})</TabsTrigger>
          {dryRunResult && <TabsTrigger value="dryrun">Dry Run</TabsTrigger>}
          {sandboxPreviews.length > 0 && <TabsTrigger value="sandbox">Sandbox</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">SMTP</span><span>{campaign.smtpProfile.label}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">From</span><span>{campaign.smtpProfile.fromEmail}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Template</span><Link href={`/templates/${campaign.template.id}`} className="hover:underline text-primary">{campaign.template.name}</Link></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Delay</span><span>{campaign.delaySeconds}s</span></div>
                {campaign.scheduledAt && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Scheduled</span><span>{new Date(campaign.scheduledAt).toLocaleString()}</span></div></>)}
                {campaign.startedAt && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Started</span><span>{new Date(campaign.startedAt).toLocaleString()}</span></div></>)}
                {campaign.completedAt && (<><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{new Date(campaign.completedAt).toLocaleString()}</span></div></>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
              <CardContent>
                {campaign.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attachments</p>
                ) : (
                  <ul className="space-y-2">
                    {campaign.attachments.map((a) => (
                      <li key={a.attachment.id} className="text-sm">{a.attachment.filename}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Contact</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium hidden sm:table-cell">Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.queueItems.map((qi) => (
                      <tr key={qi.id} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="p-3">{qi.contact.name}</td>
                        <td className="p-3 text-muted-foreground">{qi.contact.email}</td>
                        <td className="p-3">
                          <Badge className={cn("text-xs", QUEUE_STATUS_COLORS[qi.status])}>
                            {qi.status}
                          </Badge>
                          {qi.lastError && <p className="text-xs text-destructive mt-1 truncate max-w-32">{qi.lastError}</p>}
                        </td>
                        <td className="p-3 text-muted-foreground hidden sm:table-cell">
                          {qi.sentAt ? new Date(qi.sentAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {dryRunResult && (
          <TabsContent value="dryrun" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {dryRunResult.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <CardTitle className="text-base">
                    {dryRunResult.passed ? "Dry Run Passed" : "Dry Run Failed"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Recipients:</span> {dryRunResult.recipientCount}</div>
                  <div><span className="text-muted-foreground">ETA:</span> ~{dryRunResult.estimatedMinutes} min</div>
                </div>
                {dryRunResult.issues.length > 0 && (
                  <div className="space-y-2">
                    {dryRunResult.issues.map((issue, i) => (
                      <div key={i} className={cn("flex items-start gap-2 p-3 rounded-md text-sm",
                        issue.type === "error" ? "bg-destructive/10 text-destructive" : "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300")}>
                        {issue.type === "error" ? <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                        {issue.message}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {sandboxPreviews.length > 0 && (
          <TabsContent value="sandbox" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Email Preview</CardTitle>
                  <div className="flex gap-2">
                    {sandboxPreviews.map((p, i) => (
                      <Button
                        key={p.contactId}
                        size="sm"
                        variant={activeSandbox === i ? "default" : "outline"}
                        onClick={() => setActiveSandbox(i)}
                      >
                        {p.contactName.split(" ")[0]}
                      </Button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Preview as: {sandboxPreviews[activeSandbox]?.contactName} ({sandboxPreviews[activeSandbox]?.contactEmail})
                </p>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={sandboxPreviews[activeSandbox]?.renderedHtml}
                    className="w-full min-h-[500px] border-0"
                    title="Email sandbox preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
