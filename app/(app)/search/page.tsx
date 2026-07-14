"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search as SearchIcon, Users, Send, FileText, Paperclip, Server, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface SearchResult {
  type: "contact" | "campaign" | "template" | "attachment" | "smtp" | "tag";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_ICONS = {
  contact: Users,
  campaign: Send,
  template: FileText,
  attachment: Paperclip,
  smtp: Server,
  tag: Tag,
};

const TYPE_LABELS = {
  contact: "Contact",
  campaign: "Campaign",
  template: "Template",
  attachment: "Attachment",
  smtp: "SMTP Profile",
  tag: "Tag",
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setResults(data.results);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Search</h1>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts, campaigns, templates, SMTP profiles, tags..."
          className="pl-10 h-12 text-base"
        />
      </div>

      {query.length >= 2 && !loading && results.length === 0 && <p className="text-muted-foreground mb-4">No results found for &quot;{query}&quot;.</p>}

      {Object.entries(grouped).map(([type, items]) => {
        const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
              </span>
            </div>
            <Card>
              <CardContent className="p-0">
                {items.map((result, i) => (
                  <Link
                    key={result.id}
                    href={result.href}
                    className={`flex items-center justify-between p-4 hover:bg-accent transition-colors ${i < items.length - 1 ? "border-b" : ""}`}
                  >
                    <div>
                      <p className="font-medium">{result.title}</p>
                      <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{TYPE_LABELS[type as keyof typeof TYPE_LABELS]}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        );
      })}

      {query.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Type to search across all data</p>
          <p className="text-sm mt-1">Contacts, campaigns, templates, attachments, SMTP profiles, tags</p>
        </div>
      )}
    </div>
  );
}
