import { BaseScraper } from "./base.js";
import type { Listing, PropertyType, ScraperFilters } from "./types.js";

const TYPE_FILTER: Record<PropertyType, string> = {
  moradia: "com-moradias",
  apartamento: "com-apartamentos",
};

export class SupercasaScraper extends BaseScraper {
  readonly name = "supercasa";
  readonly baseUrl = "https://supercasa.pt";

  private filters: ScraperFilters;

  constructor(filters: ScraperFilters = {}) {
    super();
    this.filters = {
      transaction: "comprar",
      propertyType: "moradia",
      location: ["leiria"],
      ...filters,
    };
  }

  private listingsUrl(page: number): string {
    const type = (this.filters.propertyType as PropertyType) ?? "moradia";
    const isRent = this.filters.transaction === "arrendar";
    const transactionSlug = isRent ? "arrendar-casas" : "comprar-casas";
    const loc = this.filters.location?.length ? this.filters.location.join("/") : "";
    const typeFilter = TYPE_FILTER[type];

    const segments: string[] = [transactionSlug, loc, typeFilter];
    if (this.filters.priceMin != null) segments.push(`com-preco-min-${this.filters.priceMin}`);
    if (this.filters.priceMax != null) segments.push(`com-preco-max-${this.filters.priceMax}`);
    if (page > 1) segments.push(`pagina-${page}`);

    return `${this.baseUrl}/${segments.filter(Boolean).join("/")}`;
  }

  async scrape(maxPages = 3, limit?: number): Promise<Listing[]> {
    let allListings: Listing[] = [];

    for (let page = 1; page <= maxPages; page++) {
      console.log(`[${this.name}] Scraping page ${page}/${maxPages}...`);
      try {
        const listings = await this.scrapePage(page);
        if (listings.length === 0) {
          console.log(`[${this.name}] No listings on page ${page}, stopping.`);
          break;
        }
        allListings.push(...listings);
        console.log(`[${this.name}] Got ${listings.length} from page ${page} (total: ${allListings.length})`);
        if (limit != null && allListings.length >= limit) break;
      } catch (err) {
        console.error(`[${this.name}] Failed page ${page}:`, (err as Error).message);
        break;
      }
      if (page < maxPages) await this.page.waitForTimeout(2000 + Math.random() * 2000);
    }

    if (limit != null && allListings.length > limit) {
      console.log(`[${this.name}] Trimming from ${allListings.length} to ${limit}`);
      allListings = allListings.slice(0, limit);
    }

    console.log(`[${this.name}] Scraping phones for ${allListings.length} listings...`);
    for (let i = 0; i < allListings.length; i++) {
      const listing = allListings[i];
      try {
        const phone = await this.scrapePhone(listing.url);
        if (phone) {
          listing.phone = phone;
          console.log(`[${this.name}] [${i + 1}/${allListings.length}] Phone: ${phone}`);
        } else {
          console.log(`[${this.name}] [${i + 1}/${allListings.length}] No phone`);
        }
      } catch (err) {
        console.log(`[${this.name}] [${i + 1}/${allListings.length}] Phone scrape failed: ${(err as Error).message}`);
      }
      await this.page.waitForTimeout(1000 + Math.random() * 1500);
    }

    return allListings;
  }

  private async scrapePage(pageNum: number): Promise<Listing[]> {
    await this.page.goto(this.listingsUrl(pageNum), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    if (pageNum === 1) await this.dismissCookies();
    await this.page.waitForSelector("article.property-card", { timeout: 15000 });
    await this.page.waitForTimeout(1000);

    const propertyType = (this.filters.propertyType as PropertyType) ?? "moradia";

    const listings = await this.page.evaluate(
      (args: { source: string; type: PropertyType; baseUrl: string }) => {
        const cards = document.querySelectorAll("article.property-card");
        const results: {
          title: string;
          price: string;
          pricePerM2: string;
          location: string;
          area: string;
          rooms: string;
          url: string;
          source: string;
          type: PropertyType;
        }[] = [];

        for (const card of cards) {
          const linkEl = card.querySelector(".property-card__title a") as HTMLAnchorElement | null;
          const titleHref = linkEl?.getAttribute("href") || "";
          if (!titleHref) continue;

          // URLs are relative ("/venda-moradia-t4-leiria/i2107794")
          let url = "";
          try {
            url = new URL(titleHref, args.baseUrl).toString();
          } catch {
            continue;
          }

          const title = (linkEl?.textContent || "").trim();
          const price = (card.querySelector(".property-card__price span") as HTMLElement | null)?.innerText.trim() || "";

          // Rooms: parse T0–T5+ from title or URL slug
          const roomsFromTitle = title.match(/\bT\d\+?\b/i);
          const roomsFromSlug = titleHref.match(/-t(\d\+?)-/i);
          const rooms = roomsFromTitle
            ? roomsFromTitle[0].toUpperCase()
            : roomsFromSlug
              ? `T${roomsFromSlug[1]}`
              : "";

          // Location: supercasa cards don't expose a dedicated location element.
          // Title sometimes embeds it ("em <area>, <city>"), but the patterns
          // are inconsistent and often produce a duplicate-of-title. Leave empty;
          // the listing title is the searchable handle on this source.
          const location = "";

          results.push({
            title,
            price,
            pricePerM2: "",
            location,
            area: "",
            rooms,
            url,
            source: args.source,
            type: args.type,
          });
        }

        return results;
      },
      { source: this.name, type: propertyType, baseUrl: this.baseUrl }
    );

    return listings;
  }

  /**
   * supercasa gates phone reveal behind login (User.openLoginPopup on click).
   * Probe detail page for pre-rendered `tel:` link or JSON-LD telephone.
   */
  private async scrapePhone(listingUrl: string): Promise<string | undefined> {
    await this.page.goto(listingUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await this.dismissCookies();
    await this.page.waitForTimeout(800);

    const telLink = this.page.locator('a[href^="tel:"]').first();
    if ((await telLink.count()) > 0) {
      const href = await telLink.getAttribute("href");
      if (href) return href.replace("tel:", "").trim();
    }

    const ldPhone = await this.page.evaluate(() => {
      const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || "");
          const tel: string | undefined =
            data?.telephone ??
            data?.seller?.telephone ??
            data?.offers?.seller?.telephone ??
            data?.agent?.telephone;
          if (typeof tel === "string" && tel.trim()) return tel.trim();
        } catch {
          // ignore
        }
      }
      return undefined;
    });

    return ldPhone;
  }

  private async dismissCookies(): Promise<void> {
    try {
      const selectors = [
        "#didomi-notice-agree-button",
        "#onetrust-accept-btn-handler",
        'button:has-text("Aceitar")',
        'button:has-text("Concordo")',
      ];
      for (const selector of selectors) {
        const btn = this.page.locator(selector).first();
        if ((await btn.count()) > 0) {
          await btn.click({ timeout: 3000 });
          console.log(`[${this.name}] Dismissed cookie consent.`);
          return;
        }
      }
    } catch {
      // No banner
    }
  }
}
