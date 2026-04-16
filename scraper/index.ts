import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { ImovirtualScraper } from "./imovirtual.js";
import { syncToConvex } from "./sync.js";
import type { Listing } from "./types.js";

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let pages = 3;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--limit" || args[i] === "-l") && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
    if ((args[i] === "--pages" || args[i] === "-p") && args[i + 1]) {
      pages = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { limit, pages };
}

const PROPERTY_TYPES = ["moradia", "apartamento"] as const;

async function scrapePropertyType(
  propertyType: "moradia" | "apartamento",
  maxPages: number,
  limit?: number
): Promise<Listing[]> {
  const scraper = new ImovirtualScraper({
    transaction: "comprar",
    propertyType,
    location: ["leiria", "leiria"],
    ownerType: "ALL",
  });

  console.log(`\n=== Scraping ${propertyType} ===\n`);

  let listings: Listing[] = [];
  try {
    await scraper.init();
    listings = await scraper.scrape(maxPages, limit);
    console.log(`\nScraped ${listings.length} ${propertyType} listings.`);
  } catch (err) {
    console.error(`Scraper error (${propertyType}):`, err);
  } finally {
    await scraper.close();
  }

  return listings;
}

async function main(): Promise<void> {
  const { limit, pages } = parseArgs();

  if (limit != null) console.log(`Limit: ${limit} listings per type`);
  console.log(`Pages: ${pages} per type`);

  const allListings: Listing[] = [];

  for (const type of PROPERTY_TYPES) {
    const listings = await scrapePropertyType(type, pages, limit);
    allListings.push(...listings);
  }

  if (allListings.length === 0) {
    console.log("No listings found. Exiting.");
    return;
  }

  console.log(`\nTotal: ${allListings.length} listings. Syncing to Convex...`);
  const { inserted, updated } = await syncToConvex(allListings);
  console.log(`Done. ${inserted} new, ${updated} updated.`);
}

main().catch(console.error);
