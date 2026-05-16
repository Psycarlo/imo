import { BaseScraper } from "./base.js";
import type { Listing, PropertyType, ScraperFilters } from "./types.js";

const CATEGORY_PATH: Record<PropertyType, { sell: string; rent: string }> = {
  moradia: {
    sell: "casas-moradias-para-arrendar-vender/moradias-venda",
    rent: "casas-moradias-para-arrendar-vender/moradias-arrenda",
  },
  apartamento: {
    sell: "apartamento-casa-a-venda/apartamentos-venda",
    rent: "apartamento-casa-a-venda/apartamentos-arrenda",
  },
};

export class OlxScraper extends BaseScraper {
  readonly name = "olx";
  readonly baseUrl = "https://www.olx.pt";

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
    const category = isRent ? CATEGORY_PATH[type].rent : CATEGORY_PATH[type].sell;
    const loc = this.filters.location?.length ? this.filters.location.join("/") : "";
    const basePath = `${this.baseUrl}/imoveis/${category}/${loc}/`;

    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (this.filters.priceMin != null) params.set("search[filter_float_price:from]", String(this.filters.priceMin));
    if (this.filters.priceMax != null) params.set("search[filter_float_price:to]", String(this.filters.priceMax));

    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
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
      if (page < maxPages) await this.page.waitForTimeout(1500 + Math.random() * 1500);
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
      await this.page.waitForTimeout(800 + Math.random() * 1200);
    }

    return allListings;
  }

  private async scrapePage(pageNum: number): Promise<Listing[]> {
    await this.page.goto(this.listingsUrl(pageNum), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    if (pageNum === 1) await this.dismissCookies();
    await this.page.waitForSelector('[data-cy="l-card"]', { timeout: 15000 });
    await this.page.waitForTimeout(1000);

    const propertyType = (this.filters.propertyType as PropertyType) ?? "moradia";

    const listings = await this.page.evaluate(
      (args: { source: string; type: PropertyType; baseUrl: string }) => {
        const cards = document.querySelectorAll('[data-cy="l-card"]');
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
          const linkEl = card.querySelector("a") as HTMLAnchorElement | null;
          if (!linkEl?.href) continue;

          // Skip cross-posted listings (e.g. imovirtual ads that surface inside OLX grid)
          let url: URL;
          try { url = new URL(linkEl.href); } catch { continue; }
          if (url.hostname !== "www.olx.pt" && url.hostname !== "olx.pt") continue;

          const fullUrl = url.origin + url.pathname;
          const title =
            (card.querySelector("h4") as HTMLElement | null)?.innerText.trim() ||
            (card.querySelector('[data-cy="ad-card-title"]') as HTMLElement | null)?.innerText.split("\n")[0].trim() ||
            "";

          const priceRaw =
            (card.querySelector('[data-testid="ad-price"]') as HTMLElement | null)?.innerText.trim() || "";
          // OLX appends "Negociável" / "Negotiable" suffix on a new line — keep only first line
          const price = priceRaw.split("\n")[0].trim();

          const text = (card as HTMLElement).innerText || "";
          const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

          // Location: line containing " - " (location - relative date) — take part before " - "
          const locLine = lines.find((l) => / - /.test(l) && !/€/.test(l));
          const location = locLine ? locLine.split(" - ")[0].trim() : "";

          // Area: line like "201 m²"
          const areaLine = lines.find((l) => /^\d[\d\s.,]*\s*m²$/.test(l));
          const area = areaLine || "";

          // Rooms: parse "T0".."T5+" from title (case-insensitive, normalize to uppercase)
          const roomsMatch = title.match(/\bT\d\+?\b/i);
          const rooms = roomsMatch ? roomsMatch[0].toUpperCase() : "";

          results.push({
            title,
            price,
            pricePerM2: "",
            location,
            area,
            rooms,
            url: fullUrl,
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
   * OLX gates phone reveal behind login (clicking "Ver número" → "Mostrar"
   * opens a login modal). Without authenticated session, the number is not
   * exposed. We opportunistically read JSON-LD `telephone` and any pre-rendered
   * `tel:` link; otherwise return undefined and move on.
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

    // JSON-LD Product schema sometimes carries seller.telephone
    const ldPhone = await this.page.evaluate(() => {
      const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || "");
          const tel: string | undefined =
            data?.telephone ??
            data?.seller?.telephone ??
            data?.offers?.seller?.telephone;
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
        "#onetrust-accept-btn-handler",
        'button[id*="accept"]',
        'button:has-text("Aceitar")',
        'button:has-text("Concordo")',
        'button:has-text("OK")',
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
