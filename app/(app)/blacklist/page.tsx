"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldBan, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { blacklistSchema, type BlacklistFormData } from "@/lib/validations";

interface BlacklistEntry {
  id: string;
  email: string;
  reason: string | null;
  createdAt: string;
}

export default function BlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BlacklistFormData>({
    resolver: zodResolver(blacklistSchema),
  });

  async function fetchEntries() {
    const res = await fetch("/api/blacklist");
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchEntries(); }, []);

  async function onAdd(data: BlacklistFormData) {
    const res = await fetch("/api/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Email blacklisted");
      setShowAdd(false);
      reset();
      fetchEntries();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to blacklist");
    }
  }

  async function removeEntry(id: string) {
    const res = await fetch(`/api/blacklist/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Removed from blacklist");
      fetchEntries();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blacklist</h1>
          <p className="text-muted-foreground mt-1">
            Blacklisted emails are automatically excluded from all future campaigns.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add to Blacklist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Blacklist Email</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onAdd)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bl-email">Email Address</Label>
                <Input id="bl-email" type="email" {...register("email")} placeholder="someone@example.com" />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bl-reason">Reason (optional)</Label>
                <Input id="bl-reason" {...register("reason")} placeholder="Unsubscribed, bounced, etc." />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Blacklist Email
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ShieldBan className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No blacklisted emails yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{entries.length} blacklisted email{entries.length !== 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead className="hidden md:table-cell">Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">{entry.email}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {entry.reason || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove from blacklist?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {entry.email} will be eligible for future campaigns.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeEntry(entry.id)}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
