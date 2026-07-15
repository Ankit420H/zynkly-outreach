"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, PlayCircle, PauseCircle, ArchiveIcon, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/campaigns/lifecycle";
import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@prisma/client";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  createdAt: string;
  completedAt: string | null;
  smtpProfile: { id: string; label: string; fromEmail: string };
  template: { id: string; name: string };
  _count: { queueItems: number; attachments: number };
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCampaigns() {
    const res = await fetch("/api/campaigns");
    if (res.ok) setCampaigns(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  async function transition(id: string, status: CampaignStatus) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Campaign ${STATUS_LABELS[status]}`);
      fetchCampaigns();
    } else {
      const err = await res.json();
      toast.error(err.error?.message || "Failed to update campaign");
    }
  }

  const grouped = {
    active: campaigns.filter((c) => ["SENDING", "QUEUED", "PAUSED"].includes(c.status)),
    ready: campaigns.filter((c) => ["DRAFT", "DRY_RUN", "READY"].includes(c.status)),
    done: campaigns.filter((c) => ["COMPLETED", "ARCHIVED"].includes(c.status)),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-20 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No campaigns yet. Create your first campaign.</p>
            <Button asChild><Link href="/campaigns/new">Create Campaign</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.active.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Active
              </h2>
              <div className="space-y-3">
                {grouped.active.map((c) => <CampaignCard key={c.id} campaign={c} onTransition={transition} onClick={() => router.push(`/campaigns/${c.id}`)} />)}
              </div>
            </section>
          )}
          {grouped.ready.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">In Progress</h2>
              <div className="space-y-3">
                {grouped.ready.map((c) => <CampaignCard key={c.id} campaign={c} onTransition={transition} onClick={() => router.push(`/campaigns/${c.id}`)} />)}
              </div>
            </section>
          )}
          {grouped.done.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Completed</h2>
              <div className="space-y-3">
                {grouped.done.map((c) => <CampaignCard key={c.id} campaign={c} onTransition={transition} onClick={() => router.push(`/campaigns/${c.id}`)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  onTransition,
  onClick,
}: {
  campaign: Campaign;
  onTransition: (id: string, status: CampaignStatus) => void;
  onClick: () => void;
}) {
  const progress = campaign.totalEmails > 0
    ? Math.round(((campaign.sentEmails + campaign.failedEmails) / campaign.totalEmails) * 100)
    : 0;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-base truncate">{campaign.name}</span>
              <Badge className={cn("text-xs shrink-0", STATUS_COLORS[campaign.status])}>
                {STATUS_LABELS[campaign.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {campaign.smtpProfile.label} · {campaign.template.name} · {campaign.totalEmails} recipients
            </p>
            {campaign.totalEmails > 0 && (
              <div className="mt-3 space-y-1">
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{campaign.sentEmails} sent · {campaign.failedEmails} failed</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {campaign.status === "DRAFT" && (
              <Button size="sm" variant="outline" onClick={() => onTransition(campaign.id, "DRY_RUN" as CampaignStatus)}>
                Dry Run
              </Button>
            )}
            {campaign.status === "READY" && (
              <Button size="sm" onClick={() => onTransition(campaign.id, "QUEUED" as CampaignStatus)}>
                <PlayCircle className="mr-1 h-3 w-3" />Start
              </Button>
            )}
            {campaign.status === "SENDING" && (
              <Button size="sm" variant="outline" onClick={() => onTransition(campaign.id, "PAUSED" as CampaignStatus)}>
                <PauseCircle className="mr-1 h-3 w-3" />Pause
              </Button>
            )}
            {campaign.status === "PAUSED" && (
              <Button size="sm" onClick={() => onTransition(campaign.id, "SENDING" as CampaignStatus)}>
                <PlayCircle className="mr-1 h-3 w-3" />Resume
              </Button>
            )}
            {campaign.status === "COMPLETED" && (
              <Button size="sm" variant="ghost" onClick={() => onTransition(campaign.id, "ARCHIVED" as CampaignStatus)}>
                <ArchiveIcon className="mr-1 h-3 w-3" />Archive
              </Button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
