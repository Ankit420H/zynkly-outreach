"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Server,
  Zap,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/campaigns/lifecycle";
import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@prisma/client";

interface DashboardData {
  totalContacts: number;
  totalCampaigns: number;
  activeCampaign: {
    id: string;
    name: string;
    status: CampaignStatus;
    smtpProfile: { label: string; fromEmail: string };
    template: { name: string };
    progress: { sent: number; failed: number; total: number; current: number } | null;
  } | null;
  recentCampaigns: {
    id: string;
    name: string;
    status: CampaignStatus;
    totalEmails: number;
    sentEmails: number;
    failedEmails: number;
    createdAt: string;
    completedAt: string | null;
  }[];
  totalEmailsSent: number;
  totalEmailsFailed: number;
  totalEmailsPending: number;
  activeSmtpProfile: { id: string; label: string; fromEmail: string } | null;
}

function StatCard({ title, value, icon: Icon, description }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const progressPercent = data.activeCampaign?.progress
    ? Math.round((data.activeCampaign.progress.current / data.activeCampaign.progress.total) * 100)
    : 0;

  const eta = data.activeCampaign?.progress
    ? Math.ceil(
        ((data.activeCampaign.progress.total - data.activeCampaign.progress.current) * 5) / 60
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3" />
          Live
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Contacts" value={data.totalContacts.toLocaleString()} icon={Users} />
        <StatCard title="Emails Sent" value={data.totalEmailsSent.toLocaleString()} icon={CheckCircle2} description="All time" />
        <StatCard title="Emails Pending" value={data.totalEmailsPending.toLocaleString()} icon={Clock} />
        <StatCard title="Emails Failed" value={data.totalEmailsFailed.toLocaleString()} icon={XCircle} />
      </div>

      {/* Active Campaign */}
      {data.activeCampaign && (
        <Card className="border-primary/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <CardTitle>Active Campaign</CardTitle>
              </div>
              <Badge className={cn(STATUS_COLORS[data.activeCampaign.status])}>
                {STATUS_LABELS[data.activeCampaign.status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{data.activeCampaign.name}</p>
                <p className="text-sm text-muted-foreground">
                  via {data.activeCampaign.smtpProfile.label} · Template: {data.activeCampaign.template.name}
                </p>
              </div>
              {eta > 0 && (
                <p className="text-sm text-muted-foreground">
                  ETA: ~{eta} min
                </p>
              )}
            </div>
            {data.activeCampaign.progress && (
              <>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{data.activeCampaign.progress.current} / {data.activeCampaign.progress.total} emails</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{data.activeCampaign.progress.sent}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{data.activeCampaign.progress.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.activeCampaign.progress.total - data.activeCampaign.progress.current}</p>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* SMTP Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Active SMTP</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.activeSmtpProfile ? (
              <div>
                <p className="font-medium">{data.activeSmtpProfile.label}</p>
                <p className="text-sm text-muted-foreground">{data.activeSmtpProfile.fromEmail}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No verified SMTP profile</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Recent Campaigns</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns yet</p>
            ) : (
              <div className="space-y-3">
                {data.recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.sentEmails}/{campaign.totalEmails} sent
                      </p>
                    </div>
                    <Badge variant="secondary" className={cn("text-xs shrink-0", STATUS_COLORS[campaign.status])}>
                      {STATUS_LABELS[campaign.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
