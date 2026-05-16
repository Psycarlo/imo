export type Transaction = "comprar" | "arrendar";
export type PropertyType = "moradia" | "apartamento";

export interface Listing {
  title: string;
  price: string;
  pricePerM2: string;
  location: string;
  area: string;
  rooms: string;
  url: string;
  source: string;
  type: PropertyType;
  phone?: string;
}

/**
 * Shared filter shape. Each site uses the subset it supports.
 * Site-specific extras allowed via index signature.
 */
export interface ScraperFilters {
  transaction?: Transaction;
  propertyType?: PropertyType;
  /** URL path segments, e.g. ["leiria", "leiria"] */
  location?: string[];
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  /** e.g. ["ONE","TWO","THREE","FOUR","FIVE","SIX_OR_MORE"] */
  roomsNumber?: string[];
  /** "ALL" | "PRIVATE" | "AGENCY" — imovirtual */
  ownerType?: string;
  [key: string]: unknown;
}
