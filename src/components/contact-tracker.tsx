"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Minus, Plus, Phone } from "lucide-react";

export function ContactTracker({
  listingId,
  count,
}: {
  listingId: Id<"listings">;
  count: number;
}) {
  const increment = useMutation(api.listings.incrementContact);
  const decrement = useMutation(api.listings.decrementContact);

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={() => decrement({ id: listingId })}
        disabled={count === 0}
        className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span
        className={`inline-flex min-w-[28px] items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          count > 0
            ? "bg-green-100 text-green-700"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Phone className="h-3 w-3" />
        {count}
      </span>
      <button
        onClick={() => increment({ id: listingId })}
        className="rounded p-0.5 hover:bg-accent"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
