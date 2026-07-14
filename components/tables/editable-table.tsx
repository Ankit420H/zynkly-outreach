// components/tables/editable-table.tsx
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Pencil, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { MobileCardView } from "./mobile-card-view";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
  edit?: (row: T, onSave: (value: unknown) => void, onCancel: () => void) => React.ReactNode;
  sortable?: boolean;
}

interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline";
  onClick: (ids: string[]) => void | Promise<void>;
  confirm?: string;
}

interface EditableTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  onSave?: (row: T) => Promise<void>;
  bulkActions?: BulkAction[];
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  emptyMessage?: string;
  pageSize?: number;
  getRowId: (row: T) => string;
  renderMobileCard?: (row: T) => React.ReactNode;
}

export function EditableTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  onSave,
  bulkActions,
  selection = [],
  onSelectionChange,
  emptyMessage = "No records found",
  pageSize = 50,
  getRowId,
  renderMobileCard,
}: EditableTableProps<T>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- Media query listener required for responsive behavior */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const allSelected = paginatedData.length > 0 && paginatedData.every((row) => selection.includes(getRowId(row)));

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selection.filter((id) => !paginatedData.some((r) => getRowId(r) === id)));
    } else {
      const newSelection = new Set(selection);
      paginatedData.forEach((row) => newSelection.add(getRowId(row)));
      onSelectionChange(Array.from(newSelection));
    }
  }, [allSelected, onSelectionChange, paginatedData, selection, getRowId]);

  const toggleRow = useCallback((row: T) => {
    if (!onSelectionChange) return;
    const id = getRowId(row);
    const newSelection = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
    onSelectionChange(newSelection);
  }, [onSelectionChange, selection, getRowId]);

  const startEdit = useCallback((row: T) => {
    setEditingId(getRowId(row));
  }, [getRowId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSave = useCallback(async (row: T) => {
    if (!onSave) return;
    setSavingId(getRowId(row));
    try {
      await onSave(row);
      setEditingId(null);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSavingId(null);
    }
  }, [onSave, getRowId]);

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  if (isMobile && renderMobileCard) {
    return (
      <div className="space-y-3">
        {bulkActions && selection.length > 0 && (
          <BulkActionBar actions={bulkActions} selectedCount={selection.length} selectedIds={selection} onClear={() => onSelectionChange?.([])} />
        )}
        <MobileCardView data={data} renderCard={renderMobileCard} emptyMessage={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bulkActions && selection.length > 0 && (
        <BulkActionBar actions={bulkActions} selectedCount={selection.length} selectedIds={selection} onClear={() => onSelectionChange?.([])} />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {onSelectionChange && (
                    <th className="p-3 w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th key={col.key} className={cn("text-left p-3 font-medium", col.width)}>
                      {col.header}
                    </th>
                  ))}
                  {(onSave || onRowClick) && <th className="p-3 w-20">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row) => {
                  const rowId = getRowId(row);
                  const isEditing = editingId === rowId;
                  const isSaving = savingId === rowId;

                  return (
                    <tr
                      key={rowId}
                      className={cn(
                        "border-b last:border-0 transition-colors",
                        onRowClick && !isEditing ? "cursor-pointer hover:bg-accent/50" : "",
                        isEditing ? "bg-accent/30" : ""
                      )}
                      onClick={() => !isEditing && onRowClick?.(row)}
                    >
                      {onSelectionChange && (
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selection.includes(rowId)}
                            onCheckedChange={() => toggleRow(row)}
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className="p-3">
                          {isEditing && col.edit ? (
                            col.edit(row, () => handleSave(row), cancelEdit)
                          ) : (
                            col.render(row)
                          )}
                        </td>
                      ))}
                      {(onSave || onRowClick) && (
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleSave(row)}
                                  disabled={isSaving}
                                >
                                {isSaving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="h-3 w-3" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : onSave ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100"
                              onClick={() => startEdit(row)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkActionBar({ actions, selectedCount, selectedIds, onClear }: { actions: BulkAction[]; selectedCount: number; selectedIds: string[]; onClear: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: BulkAction) => {
    if (action.confirm && !confirm(action.confirm)) return;
    setLoading(true);
    try {
      await action.onClick(selectedIds);
      if (action.variant !== "destructive") {
        toast.success(`Action applied to ${selectedCount} items`);
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setLoading(false);
      onClear();
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg border">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <div className="h-4 w-px bg-border" />
      {actions.map((action, i) => (
        <Button
          key={i}
          variant={action.variant || "outline"}
          size="sm"
          onClick={() => handleAction(action)}
          disabled={loading}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
        Clear
      </Button>
    </div>
  );
}