import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { ConvexHttpClient } from "convex/browser";
import { BaseScraper } from "./base.js";
import { CasaIolScraper } from "./casaiol.js";
import { CasaSapoScraper } from "./casasapo.js";
import { CasayesScraper } from "./casayes.js";
import { ImovirtualScraper } from "./imovirtual.js";
import { OlxScraper } from "./olx.js";
import { SupercasaScraper } from "./supercasa.js";
import { syncToConvex } from "./sync.js";
import { api } from "../convex/_generated/api";
import type { Listing, PropertyType, ScraperFilters, Transaction } from "./types.js";

type ScraperCtor = new (filters: ScraperFilters) => BaseScraper;

const REGISTRY: Record<string, ScraperCtor> = {
  imovirtual: ImovirtualScraper,
  olx: OlxScraper,
  "casa.sapo": CasaSapoScraper,
  supercasa: SupercasaScraper,
  "casa.iol": CasaIolScraper,
  casayes: CasayesScraper,
};

interface RuntimeConfig {
  source: string;
  enabled: boolean;
  transaction: Transaction;
  propertyTypes: PropertyType[];
  location: string[];
  ownerType?: string;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  pages?: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let pagesOverride: number | undefined;
  let only: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--limit" || args[i] === "-l") && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
    if ((args[i] === "--pages" || args[i] === "-p") && args[i + 1]) {
      pagesOverride = parseInt(args[i + 1], 10);
      i++;
    }
    if ((args[i] === "--only" || args[i] === "-o") && args[i + 1]) {
      only = args[i + 1];
      i++;
    }
  }

  return { limit, pagesOverride, only };
}

async function loadConfigs(client: ConvexHttpClient): Promise<RuntimeConfig[]> {
  const rows = await client.query(api.scraperConfigs.list, {});
  if (rows.length === 0) {
    console.log("No scraperConfigs rows. Seeding defaults...");
    await client.mutation(api.scraperConfigs.seed, {});
    return await client.query(api.scraperConfigs.list, {});
  }
  return rows;
}

async function scrapeSiteType(
  source: string,
  Ctor: ScraperCtor,
  config: RuntimeConfig,
  propertyType: PropertyType,
  maxPages: number,
  limit?: number
): Promise<Listing[]> {
  const filters: ScraperFilters = {
    transaction: config.transaction,
    propertyType,
    location: config.location,
    ownerType: config.ownerType,
    priceMin: config.priceMin,
    priceMax: config.priceMax,
    areaMin: config.areaMin,
    areaMax: config.areaMax,
  };

  const scraper = new Ctor(filters);

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
  const { limit, pagesOverride, only } = parseArgs();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL env var not set. Add it to .env.local");
  }
  const client = new ConvexHttpClient(convexUrl);

  const configs = await loadConfigs(client);

  if (limit != null) console.log(`Limit: ${limit} listings per type`);
  if (pagesOverride != null) console.log(`Pages override: ${pagesOverride}`);
  if (only) console.log(`Filter: only=${only}`);

  const allListings: Listing[] = [];

  for (const config of configs) {
    if (!config.enabled) continue;
    if (only && config.source !== only) continue;
    const Ctor = REGISTRY[config.source];
    if (!Ctor) {
      console.warn(`No scraper class registered for "${config.source}", skipping.`);
      continue;
    }

    const pages = pagesOverride ?? config.pages ?? 3;

    for (const type of config.propertyTypes) {
      const listings = await scrapeSiteType(config.source, Ctor, config, type, pages, limit);
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
