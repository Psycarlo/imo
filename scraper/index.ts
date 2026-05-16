import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { BaseScraper } from "./base.js";
import { SCRAPER_CONFIG, type SiteConfig } from "./config.js";
import { CasaIolScraper } from "./casaiol.js";
import { CasaSapoScraper } from "./casasapo.js";
import { CasayesScraper } from "./casayes.js";
import { ImovirtualScraper } from "./imovirtual.js";
import { OlxScraper } from "./olx.js";
import { SupercasaScraper } from "./supercasa.js";
import { syncToConvex } from "./sync.js";
import type { Listing, PropertyType, ScraperFilters } from "./types.js";

type ScraperCtor = new (filters: ScraperFilters) => BaseScraper;

const REGISTRY: Record<string, ScraperCtor> = {
  imovirtual: ImovirtualScraper,
  olx: OlxScraper,
  "casa.sapo": CasaSapoScraper,
  supercasa: SupercasaScraper,
  "casa.iol": CasaIolScraper,
  casayes: CasayesScraper,
};

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let pages = 3;
  let only: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--limit" || args[i] === "-l") && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
    if ((args[i] === "--pages" || args[i] === "-p") && args[i + 1]) {
      pages = parseInt(args[i + 1], 10);
      i++;
    }
    if ((args[i] === "--only" || args[i] === "-o") && args[i + 1]) {
      only = args[i + 1];
      i++;
    }
  }

  return { limit, pages, only };
}

async function scrapeSiteType(
  source: string,
  Ctor: ScraperCtor,
  config: SiteConfig,
  propertyType: PropertyType,
  maxPages: number,
  limit?: number
): Promise<Listing[]> {
  const scraper = new Ctor({
    ...config.filters,
    transaction: config.transaction,
    propertyType,
  });

  console.log(`\n=== ${source} / ${propertyType} ===\n`);

  let listings: Listing[] = [];
  try {
    await scraper.init();
    listings = await scraper.scrape(maxPages, limit);
    console.log(`Scraped ${listings.length} ${propertyType} from ${source}.`);
  } catch (err) {
    console.error(`Scraper error (${source}/${propertyType}):`, err);
  } finally {
    await scraper.close();
  }

  return listings;
}

async function main(): Promise<void> {
  const { limit, pages, only } = parseArgs();

  if (limit != null) console.log(`Limit: ${limit} listings per type`);
  console.log(`Pages: ${pages} per type`);
  if (only) console.log(`Filter: only=${only}`);

  const allListings: Listing[] = [];

  for (const [source, config] of Object.entries(SCRAPER_CONFIG)) {
    if (!config.enabled) continue;
    if (only && source !== only) continue;
    const Ctor = REGISTRY[source];
    if (!Ctor) {
      console.warn(`No scraper class registered for "${source}", skipping.`);
      continue;
    }

    for (const type of config.propertyTypes) {
      const listings = await scrapeSiteType(source, Ctor, config, type, pages, limit);
      allListings.push(...listings);
    }
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
