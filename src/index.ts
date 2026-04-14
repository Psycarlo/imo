import path from "path";
import { mkdirSync } from "fs";
import { BaseScraper } from "./scrapers/base.js";
import { ImovirtualScraper } from "./scrapers/imovirtual.js";
import { exportToExcel } from "./excel.js";
import type { Listing } from "./types.js";

// Register all scrapers here — add new ones as needed
const scrapers: BaseScraper[] = [new ImovirtualScraper()];

const MAX_PAGES = 3;

async function main(): Promise<void> {
  const allListings: Listing[] = [];

  for (const scraper of scrapers) {
    console.log(`\n=== Starting ${scraper.name} (${scraper.baseUrl}) ===\n`);
    try {
      await scraper.init();
      const listings = await scraper.scrape(MAX_PAGES);
      allListings.push(...listings);
      console.log(`\n[${scraper.name}] Finished — ${listings.length} listings collected.`);
    } catch (err) {
      console.error(`[${scraper.name}] Error:`, err);
    } finally {
      await scraper.close();
    }
  }

  if (allListings.length === 0) {
    console.log("\nNo listings found. Exiting.");
    return;
  }

  const resDir = path.join(process.cwd(), "res");
  mkdirSync(resDir, { recursive: true });
  const outputPath = await exportToExcel(allListings, resDir);
  console.log(`\nExported ${allListings.length} listings to ${outputPath}`);
}

main().catch(console.error);
