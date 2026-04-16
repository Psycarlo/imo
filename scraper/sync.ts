import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Listing } from "./types.js";

export async function syncToConvex(listings: Listing[]): Promise<{ inserted: number; updated: number }> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL env var not set. Add it to .env.local");
  }

  const client = new ConvexHttpClient(convexUrl);
  let inserted = 0;
  let updated = 0;

  for (const listing of listings) {
    const result = await client.mutation(api.listings.upsertListing, {
      url: listing.url,
      title: listing.title,
      price: listing.price,
      pricePerM2: listing.pricePerM2 || undefined,
      location: listing.location,
      area: listing.area || undefined,
      rooms: listing.rooms || undefined,
      source: listing.source,
      type: listing.type,
      phone: listing.phone || undefined,
    });

    if (result.inserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  return { inserted, updated };
}
