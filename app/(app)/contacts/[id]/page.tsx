"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, GraduationCap, Linkedin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { QueueItemStatus, CampaignStatus } from "@prisma/client";

interface ContactDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  college: string;
  year: string;
  branch: string;
  department: string;
  city: string;
  state: string;
  skills: string;
  resumeUrl: string;
  linkedinUrl: string;
  source: string;
  notes: string;
  createdAt: string;
  tags: { tag: { id: string; name: string } }[];
  queueItems: {
    id: string;
    status: QueueItemStatus;
    sentAt: string | null;
    lastError: string | null;
    attempts: number;
    campaign: { id: string; name: string; status: CampaignStatus; createdAt: string };
  }[];
}

const QUEUE_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  QUEUED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  SENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  SENT: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  RETRYING: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  CANCELLED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { setContact(data); setLoading(false); });
  }, [id]);

  async function deleteContact() {
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Contact deleted");
      router.push("/contacts");
    }
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-48" /><div className="h-64 bg-muted rounded" /></div>;
  if (!contact) return <div className="text-center py-12 text-muted-foreground">Contact not found</div>;

  const infoItems = [
    { icon: Mail, label: "Email", value: contact.email },
    { icon: Phone, label: "Phone", value: contact.phone },
    { icon: Phone, label: "WhatsApp", value: contact.whatsapp },
    { icon: GraduationCap, label: "College", value: contact.college },
    { icon: GraduationCap, label: "Year", value: contact.year },
    { icon: GraduationCap, label: "Branch", value: contact.branch },
    { icon: GraduationCap, label: "Department", value: contact.department },
    { icon: MapPin, label: "City", value: contact.city },
    { icon: MapPin, label: "State", value: contact.state },
    { icon: Linkedin, label: "LinkedIn", value: contact.linkedinUrl },
  ].filter((item) => item.value);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{contact.name}</h1>
          <p className="text-muted-foreground">{contact.email}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete contact?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete {contact.name} and all their campaign history.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteContact}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Tags */}
      {contact.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {contact.tags.map((ct) => (
            <Badge key={ct.tag.id} variant="secondary">{ct.tag.name}</Badge>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Info */}
        <Card>
          <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {infoItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm">{item.value}</p>
                </div>
              </div>
            ))}
            {contact.skills && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Skills</p>
                <p className="text-sm">{contact.skills}</p>
              </div>
            )}
            {contact.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{contact.notes}</p>
              </div>
            )}
            {contact.source && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Source</p>
                <p className="text-sm">{contact.source}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign History */}
        <Card>
          <CardHeader><CardTitle>Campaign History</CardTitle></CardHeader>
          <CardContent>
            {contact.queueItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaign history</p>
            ) : (
              <div className="space-y-3">
                {contact.queueItems.map((qi) => (
                  <div key={qi.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{qi.campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {qi.sentAt ? new Date(qi.sentAt).toLocaleDateString() : new Date(qi.campaign.createdAt).toLocaleDateString()}
                        {qi.lastError && ` · ${qi.lastError}`}
                      </p>
                    </div>
                    <Badge className={cn("text-xs", QUEUE_STATUS_COLORS[qi.status])}>
                      {qi.status}
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
