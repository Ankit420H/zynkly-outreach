"use client";

import { useEffect, useState } from "react";
import { Plus, Server, CheckCircle2, XCircle, Loader2, Trash2, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { smtpProfileSchema, type SmtpProfileFormData } from "@/lib/validations";

interface SmtpProfile {
  id: string;
  label: string;
  provider: string;
  host: string;
  port: number;
  username: string;
  secure: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  isVerified: boolean;
  lastTestedAt: string | null;
}

const PROVIDER_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: "smtp.gmail.com", port: 587, secure: false },
  zoho: { host: "smtp.zoho.com", port: 465, secure: true },
  outlook: { host: "smtp-mail.outlook.com", port: 587, secure: false },
  brevo: { host: "smtp-relay.brevo.com", port: 587, secure: false },
  ses: { host: "email-smtp.us-east-1.amazonaws.com", port: 587, secure: false },
  custom: { host: "", port: 587, secure: true },
};

export default function SmtpPage() {
  const [profiles, setProfiles] = useState<SmtpProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SmtpProfileFormData>({
    resolver: zodResolver(smtpProfileSchema),
    defaultValues: { provider: "gmail", secure: false, port: 587 },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const provider = watch("provider");

  async function fetchProfiles() {
    const res = await fetch("/api/smtp");
    if (res.ok) setProfiles(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchProfiles(); }, []);

  useEffect(() => {
    if (provider && PROVIDER_PRESETS[provider]) {
      const preset = PROVIDER_PRESETS[provider];
      setValue("host", preset.host);
      setValue("port", preset.port);
      setValue("secure", preset.secure);
    }
  }, [provider, setValue]);

  async function onCreate(data: SmtpProfileFormData) {
    const res = await fetch("/api/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const result = await res.json();
      toast.success(
        result.testResult?.success
          ? "SMTP profile created and verified"
          : "SMTP profile created (verification failed)"
      );
      setShowCreate(false);
      reset();
      fetchProfiles();
    } else {
      toast.error("Failed to create SMTP profile");
    }
  }

  async function testProfile(id: string) {
    setTesting(id);
    const res = await fetch(`/api/smtp/${id}/test`, { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        toast.success("Connection verified");
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
      fetchProfiles();
    }
    setTesting(null);
  }

  async function deleteProfile(id: string) {
    const res = await fetch(`/api/smtp/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("SMTP profile deleted");
      fetchProfiles();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">SMTP Profiles</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Profile</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New SMTP Profile</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input {...register("label")} placeholder="My Gmail" />
                  {errors.label && <p className="text-sm text-destructive">{errors.label.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Controller
                    control={control}
                    name="provider"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gmail">Gmail</SelectItem>
                          <SelectItem value="zoho">Zoho</SelectItem>
                          <SelectItem value="outlook">Outlook</SelectItem>
                          <SelectItem value="brevo">Brevo</SelectItem>
                          <SelectItem value="ses">Amazon SES</SelectItem>
                          <SelectItem value="custom">Custom SMTP</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input {...register("host")} />
                  {errors.host && <p className="text-sm text-destructive">{errors.host.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input type="number" {...register("port")} />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input {...register("username")} />
                  {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" {...register("password")} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input {...register("fromName")} placeholder="Zynkly" />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input type="email" {...register("fromEmail")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reply-To (optional)</Label>
                <Input type="email" {...register("replyTo")} placeholder="reply@zynkly.com" />
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="secure"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <Label>Use TLS/SSL</Label>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Test
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted rounded animate-pulse" /></CardContent></Card>)}
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No SMTP profiles. Add one to start sending emails.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    {p.isVerified ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" />Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />Unverified
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>{p.provider} · {p.host}:{p.port}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">From:</span> {p.fromName} &lt;{p.fromEmail}&gt;</p>
                  <p><span className="text-muted-foreground">Username:</span> {p.username}</p>
                  {p.lastTestedAt && (
                    <p className="text-xs text-muted-foreground">Last tested: {new Date(p.lastTestedAt).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testProfile(p.id)}
                    disabled={testing === p.id}
                  >
                    {testing === p.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <TestTube2 className="mr-1 h-3 w-3" />}
                    Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteProfile(p.id)}>
                    <Trash2 className="mr-1 h-3 w-3 text-destructive" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
