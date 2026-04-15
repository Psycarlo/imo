export interface Listing {
  title: string;
  price: string;
  pricePerM2: string;
  location: string;
  area: string;
  rooms: string;
  url: string;
  source: string;
}

export interface ImovirtualFilters {
  /** e.g. "comprar" or "arrendar" */
  transaction?: string;
  /** e.g. "moradia", "apartamento", "terreno" */
  propertyType?: string;
  /** URL path segments for location, e.g. ["leiria", "leiria"] */
  location?: string[];
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  /** e.g. ["ONE","TWO","THREE","FOUR","FIVE","SIX_OR_MORE"] */
  roomsNumber?: string[];
  /** "ALL" | "PRIVATE" | "AGENCY" */
  ownerType?: string;
}
