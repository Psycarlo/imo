import type { PropertyType, ScraperFilters, Transaction } from "./types.js";

export interface SiteConfig {
  enabled: boolean;
  transaction: Transaction;
  propertyTypes: PropertyType[];
  /** Base filters applied per scrape. Location path is site-specific. */
  filters: Omit<ScraperFilters, "propertyType" | "transaction">;
}

/**
 * Per-site scraper config. Static for now; will move to Convex
 * table (`scraperConfig`) when dashboard editing lands.
 */
export const SCRAPER_CONFIG: Record<string, SiteConfig> = {
  imovirtual: {
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    filters: {
      location: ["leiria", "leiria"],
      ownerType: "ALL",
    },
  },
  olx: {
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    filters: {
      location: ["leiria"],
    },
  },
  "casa.sapo": {
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    filters: {
      location: ["leiria"],
    },
  },
  supercasa: {
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    filters: {
      location: ["leiria"],
    },
  },
  "casa.iol": {
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    filters: {
      location: ["leiria"],
    },
  },
  casayes: {
    enabled: true,
    transaction: "comprar",
    propertyTypes: ["moradia", "apartamento"],
    filters: {
      // [district, municipality] — remaining slots default to wildcard
      location: ["leiria", "leiria"],
    },
  },
};
