// components/tables/mobile-card-view.tsx
"use client";

import { ReactNode } from "react";

interface MobileCardViewProps<T> {
  data: T[];
  renderCard: (row: T) => ReactNode;
  emptyMessage?: string;
}

export function MobileCardView<T>({
  data,
  renderCard,
  emptyMessage = "No records found",
}: MobileCardViewProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((row, index) => (
        <div
          key={index}
          className="rounded-lg border bg-card p-4 shadow-sm"
          role="row"
        >
          {renderCard(row)}
        </div>
      ))}
    </div>
  );
}