import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { ImovirtualScraper } from "./imovirtual.js";
import { syncToConvex } from "./sync.js";
import type { Listing } from "./types.js";

const MAX_PAGES = 3;

async function main(): Promise<void> {
  const scraper = new ImovirtualScraper({
    transaction: "comprar",
    propertyType: "moradia",
    location: ["leiria", "leiria"],
    ownerType: "ALL",
  });

  console.log("\n=== Starting imovirtual scraper ===\n");

  let listings: Listing[] = [];
  try {
    await scraper.init();
    listings = await scraper.scrape(MAX_PAGES);
    console.log(`\nScraped ${listings.length} listings.`);
  } catch (err) {
    console.error("Scraper error:", err);
  } finally {
    await scraper.close();
  }

  if (listings.length === 0) {
    console.log("No listings found. Exiting.");
    return;
  }

  console.log("\nSyncing to Convex...");
  const { inserted, updated } = await syncToConvex(listings);
  console.log(`Done. ${inserted} new, ${updated} updated.`);
}

main().catch(console.error);
