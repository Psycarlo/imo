"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ListingsTable } from "@/components/listings-table";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function Home() {
  const [showHidden, setShowHidden] = useState(false);
  const listings = useQuery(api.listings.getAll, { showHidden });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IMO Tracker</h1>
          <p className="mt-1 text-muted-foreground">
            {listings === undefined
              ? "Loading..."
              : `${listings.length} listings`}
          </p>
        </div>
        <button
          onClick={() => setShowHidden(!showHidden)}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          {showHidden ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {showHidden ? "Hide dismissed" : "Show all"}
        </button>
      </div>

      {listings === undefined ? (
        <div className="py-20 text-center text-muted-foreground">
          Loading listings...
        </div>
      ) : listings.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No listings yet. Run the scraper to populate.
        </div>
      ) : (
        <ListingsTable listings={listings} />
      )}
    </main>
  );
}
