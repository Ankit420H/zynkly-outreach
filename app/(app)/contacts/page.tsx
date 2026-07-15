"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Upload, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactFormData } from "@/lib/validations";
import { createContactAction, createTagAction, deleteContactAction } from "@/app/actions/contacts";
import { useOptimistic } from "react";
import { EditableTable, type Column } from "@/components/tables/editable-table";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  city: string;
  tags: { tag: { id: string; name: string } }[];
  createdAt: string;
}

interface Tag {
  id: string;
  name: string;
  _count: { contacts: number };
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const fetchContacts = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (search) params.set("search", search);
    if (selectedTag) params.set("tagId", selectedTag);

    const res = await fetch(`/api/contacts?${params}`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data.contacts);
      setPagination(data.pagination);
    }
  }, [page, search, selectedTag]);

  const fetchTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (res.ok) setTags(await res.json());
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- Standard data-fetching pattern */
  useEffect(() => {
    fetchContacts();
    fetchTags();
  }, [fetchContacts, fetchTags]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [optimisticContacts, addOptimisticContact] = useOptimistic(
    contacts,
    (state, newContact: Contact) => [newContact, ...state]
  );

  async function onCreateContact(data: ContactFormData) {
    const tempId = crypto.randomUUID();
    addOptimisticContact({
      id: tempId,
      name: data.name,
      email: data.email,
      phone: data.phone || "",
      college: data.college || "",
      city: data.city || "",
      tags: [],
      createdAt: new Date().toISOString(),
    });

    setShowCreateDialog(false);
    reset();

    const res = await createContactAction(data);
    if (res.success) {
      toast.success("Contact created");
      fetchContacts();
    } else {
      toast.error(res.error?.message || "Failed to create contact");
      fetchContacts();
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    const res = await createTagAction(newTagName);

    if (res.success) {
      toast.success("Tag created");
      setNewTagName("");
      setShowTagDialog(false);
      fetchTags();
    } else {
      toast.error(res.error?.message || "Failed to create tag");
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} contacts? This cannot be undone.`)) return;
    
    try {
      await Promise.all(selectedIds.map((id) => deleteContactAction(id)));
      toast.success(`${selectedIds.length} contacts deleted`);
      setSelectedIds([]);
      fetchContacts();
    } catch {
      toast.error("Failed to delete contacts");
    }
  }

  const columns: Column<Contact>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => <span className="font-medium">{row.name}</span>,
      edit: (row, onSave, onCancel) => (
        <InlineEditForm
          initialValue={row.name}
          onSave={onSave}
          onCancel={onCancel}
          placeholder="Name"
        />
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => <span className="text-muted-foreground">{row.email}</span>,
      edit: (row, onSave, onCancel) => (
        <InlineEditForm
          initialValue={row.email}
          onSave={onSave}
          onCancel={onCancel}
          placeholder="Email"
          type="email"
        />
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone || "—",
      edit: (row, onSave, onCancel) => (
        <InlineEditForm
          initialValue={row.phone}
          onSave={onSave}
          onCancel={onCancel}
          placeholder="Phone"
        />
      ),
    },
    {
      key: "college",
      header: "College",
      render: (row) => row.college || "—",
      edit: (row, onSave, onCancel) => (
        <InlineEditForm
          initialValue={row.college}
          onSave={onSave}
          onCancel={onCancel}
          placeholder="College"
        />
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          {row.tags.map((ct) => (
            <Badge key={ct.tag.id} variant="secondary" className="text-xs">
              {ct.tag.name}
            </Badge>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} total contacts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/contacts/import">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Contact</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreateContact)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" {...register("name")} />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" {...register("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="college">College</Label>
                    <Input id="college" {...register("college")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" {...register("year")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" {...register("city")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...register("notes")} rows={2} />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  Create Contact
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedTag === "" ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectedTag(""); setPage(1); }}
          >
            All
          </Button>
          {tags.map((tag) => (
            <Button
              key={tag.id}
              variant={selectedTag === tag.id ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectedTag(tag.id); setPage(1); }}
            >
              {tag.name} ({tag._count.contacts})
            </Button>
          ))}
          <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Plus className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Create Tag</DialogTitle></DialogHeader>
              <div className="flex gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  onKeyDown={(e) => e.key === "Enter" && createTag()}
                />
                <Button onClick={createTag}>Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Editable Table */}
      <EditableTable
        data={optimisticContacts}
        columns={columns}
        selection={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(contact) => router.push(`/contacts/${contact.id}`)}
        onSave={async (contact) => {
          await fetch(`/api/contacts/${contact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contact),
          });
          fetchContacts();
        }}
        bulkActions={[
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4 mr-1" />,
            variant: "destructive",
            onClick: handleBulkDelete,
            confirm: `Are you sure you want to delete ${selectedIds.length} contacts?`,
          },
        ]}
        getRowId={(row) => row.id}
        emptyMessage="No contacts found. Import or add contacts to get started."
        renderMobileCard={(contact) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{contact.name}</span>
              <span className="text-sm text-muted-foreground">{contact.email}</span>
            </div>
            <div className="flex gap-2 text-sm text-muted-foreground">
              {contact.phone && <span>{contact.phone}</span>}
              {contact.college && <span>· {contact.college}</span>}
            </div>
            <div className="flex gap-1 flex-wrap">
              {contact.tags.map((ct) => (
                <Badge key={ct.tag.id} variant="secondary" className="text-xs">
                  {ct.tag.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  );
}

function InlineEditForm({
  initialValue,
  onSave,
  onCancel,
  placeholder,
  type = "text",
}: {
  initialValue: string;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  placeholder?: string;
  type?: string;
}) {
  const [value, setValue] = useState(() => initialValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave(value);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(value)}
      placeholder={placeholder}
      type={type}
      className="h-8 text-sm"
      autoFocus
    />
  );
}