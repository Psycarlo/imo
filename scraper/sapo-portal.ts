import { BaseScraper } from "./base.js";
import type { Listing, PropertyType, ScraperFilters } from "./types.js";

const CATEGORY_SLUG: Record<PropertyType, { sell: string; rent: string }> = {
  moradia: { sell: "comprar-moradias", rent: "arrendar-moradias" },
  apartamento: { sell: "comprar-apartamentos", rent: "arrendar-apartamentos" },
};

/**
 * Shared scraper for SAPO-group real-estate portals (casa.sapo.pt, casa.iol.pt).
 * These sites share an identical CMS/DOM — same card classes, same URL slugs,
 * same login-gated phone, same redirect-via-counter.aspx link wrapping.
 * Subclasses just declare `name` and `baseUrl`.
 */
export abstract class SapoPortalScraper extends BaseScraper {
  abstract readonly name: string;
  abstract readonly baseUrl: string;

  protected filters: ScraperFilters;

  constructor(filters: ScraperFilters = {}) {
    super();
    this.filters = {
      transaction: "comprar",
      propertyType: "moradia",
      location: ["leiria"],
      ...filters,
    };
  }

  protected listingsUrl(page: number): string {
    const type = (this.filters.propertyType as PropertyType) ?? "moradia";
    const isRent = this.filters.transaction === "arrendar";
    const slug = isRent ? CATEGORY_SLUG[type].rent : CATEGORY_SLUG[type].sell;
    const loc = this.filters.location?.length ? this.filters.location.join("/") : "";
    const basePath = `${this.baseUrl}/${slug}/${loc}/`;

    const params = new URLSearchParams();
    if (page > 1) params.set("pn", String(page));
    if (this.filters.priceMin != null) params.set("pf", String(this.filters.priceMin));
    if (this.filters.priceMax != null) params.set("pt", String(this.filters.priceMax));

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
      if (page < maxPages) await this.page.waitForTimeout(2500 + Math.random() * 2000);
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
      await this.page.waitForTimeout(1200 + Math.random() * 1500);
    }

    return allListings;
  }

  protected async scrapePage(pageNum: number): Promise<Listing[]> {
    await this.page.goto(this.listingsUrl(pageNum), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    if (pageNum === 1) await this.dismissCookies();
    await this.page.waitForSelector(".property", { timeout: 15000 });
    await this.page.waitForTimeout(1200);

    const propertyType = (this.filters.propertyType as PropertyType) ?? "moradia";
    const expectedHost = new URL(this.baseUrl).hostname;

    const listings = await this.page.evaluate(
      (args: { source: string; type: PropertyType; expectedHost: string }) => {
        const cards = document.querySelectorAll(".property");
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
          const linkEl = card.querySelector("a.property-info") as HTMLAnchorElement | null;
          const hrefRaw = linkEl?.href || "";
          if (!hrefRaw) continue;

          // a.property-info points to a tracking redirect:
          //   https://gespub.casa.sapo.pt/...?l=<canonical-listing-url>?g3pid=<id>
          // Extract the real URL from `l` and drop trailing tracking params.
          let url = "";
          try {
            const parsed = new URL(hrefRaw);
            const lParam = parsed.searchParams.get("l");
            if (lParam) {
              const cleaned = new URL(lParam);
              cleaned.searchParams.delete("g3pid");
              url = cleaned.toString();
            } else if (parsed.hostname === args.expectedHost) {
              parsed.searchParams.delete("g3pid");
              url = parsed.toString();
            }
          } catch {
            continue;
          }
          if (!url) continue;

          const typeLine = (card.querySelector(".property-type") as HTMLElement | null)?.innerText.trim() || "";
          const header = (card.querySelector(".featured-property-header") as HTMLElement | null)?.innerText.trim() || "";
          const title = header || typeLine || (linkEl?.getAttribute("title") ?? "");

          const location = (card.querySelector(".property-location") as HTMLElement | null)?.innerText.trim() || "";

          const priceVal = (card.querySelector(".property-price-value") as HTMLElement | null)?.innerText.trim() || "";
          const priceFallback = (card.querySelector(".property-price-item") as HTMLElement | null)?.innerText.trim() || "";
          // Cards may show current + previous + discount across lines
          // ("449.000 €\n464.000 €\n-3,23%"). Keep only the first € line.
          const pickFirstEuroLine = (raw: string): string => {
            const line = raw.split("\n").map((l) => l.trim()).find((l) => /€/.test(l));
            return line || raw.trim();
          };
          const price = priceVal
            ? pickFirstEuroLine(priceVal)
            : priceFallback
              ? pickFirstEuroLine(priceFallback)
              : "";

          const features = (card.querySelector(".property-features-text") as HTMLElement | null)?.innerText.trim() || "";
          const areaMatch = features.match(/(\d[\d.,]*)\s*m²/);
          const area = areaMatch ? `${areaMatch[1]} m²` : "";

          const roomsMatch = typeLine.match(/\bT\d\+?\b/i);
          const rooms = roomsMatch ? roomsMatch[0].toUpperCase() : "";

          results.push({
            title,
            price,
            pricePerM2: "",
            location,
            area,
            rooms,
            url,
            source: args.source,
            type: args.type,
          });
        }

        return results;
      },
      { source: this.name, type: propertyType, expectedHost }
    );

    return listings;
  }

  /**
   * SAPO portals gate phone reveal behind login (".property-phone" opens
   * `User.openLoginPopup`). Probe detail page for pre-rendered `tel:` link
   * or JSON-LD `telephone`; otherwise skip.
   */
  protected async scrapePhone(listingUrl: string): Promise<string | undefined> {
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

  protected async dismissCookies(): Promise<void> {
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
