import { BaseScraper } from "./base.js";
import type { Listing, PropertyType, ScraperFilters } from "./types.js";

const TYPE_URL_TOKEN: Record<PropertyType, string> = {
  moradia: "compra-moradia",
  apartamento: "compra-apartamento",
};

export class CasayesScraper extends BaseScraper {
  readonly name = "casayes";
  readonly baseUrl = "https://casayes.pt";

  private filters: ScraperFilters;

  constructor(filters: ScraperFilters = {}) {
    super();
    this.filters = {
      transaction: "comprar",
      propertyType: "moradia",
      location: ["leiria", "leiria"],
      ...filters,
    };
  }

  private listingsUrl(page: number): string {
    // URL shape: /pt/comprar/casaseapartamentos/<district>/<municipality>/<parish>/<features>
    // Each location slot uses "r" as wildcard. We accept up to 4 slots from
    // config.location and pad the remainder with "r".
    const transaction = this.filters.transaction === "arrendar" ? "arrendar" : "comprar";
    const loc = this.filters.location ?? [];
    const slots = [...loc, "r", "r", "r", "r"].slice(0, 4);
    const path = `${this.baseUrl}/pt/${transaction}/casaseapartamentos/${slots.join("/")}`;

    const params = new URLSearchParams();
    if (page > 1) params.set("p", String(page));

    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
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
    await this.page.waitForSelector('article[data-id="listing-card-container"]', { timeout: 15000 });
    await this.page.waitForTimeout(1500);

    const propertyType = (this.filters.propertyType as PropertyType) ?? "moradia";
    const typeToken = TYPE_URL_TOKEN[propertyType];

    const listings = await this.page.evaluate(
      (args: { source: string; type: PropertyType; baseUrl: string; typeToken: string }) => {
        const cards = document.querySelectorAll('article[data-id="listing-card-container"]');
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
          const linkEl = card.querySelector('a[data-id="listing-card-link"]') as HTMLAnchorElement | null;
          const hrefAttr = linkEl?.getAttribute("href") || "";
          if (!hrefAttr) continue;

          // casayes returns combined moradia + apartamento in one URL; filter
          // per configured propertyType by inspecting the listing's URL slug.
          if (!hrefAttr.includes(args.typeToken)) continue;

          let url = "";
          try { url = new URL(hrefAttr, args.baseUrl).toString(); } catch { continue; }

          // Some cards expose a price-styled <h3> as well; pick the title <h3>
          // by skipping any whose text is a bare € amount.
          const allH3 = [...card.querySelectorAll("h3")] as HTMLElement[];
          const titleEl = allH3.find((h) => h.innerText.trim() && !/€/.test(h.innerText));
          const title = (titleEl?.innerText.trim()) || "";
          const location = (card.querySelector("address") as HTMLElement | null)?.innerText.trim() || "";

          // Price: card text below carousel — find first € line among direct children
          const priceEl = [...card.querySelectorAll("div")].find((el) => {
            const t = (el as HTMLElement).innerText?.trim() || "";
            // Match standalone price line, not a multi-line summary
            return /^\d[\d\s.,]*\s*€$/.test(t);
          }) as HTMLElement | undefined;
          const price = priceEl?.innerText.trim() || "";

          // Bottom info block ("121m2\n3\n2\nAgent\nAgency") — area on first line
          const bottomBlock = card.querySelector(".mt-auto") as HTMLElement | null;
          const bottomLines = bottomBlock?.innerText.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];
          const areaMatch = bottomLines.find((l) => /^\d[\d.,]*\s*m2?$/i.test(l));
          const area = areaMatch ? areaMatch.replace(/m2$/i, "m²") : "";

          // Rooms: title is "Apartamento T3 em ..." — parse T-format; fall back
          // to URL slug ("/compra-moradia-t3-...") when title omits typology.
          const roomsFromTitle = title.match(/\bT\d\+?\b/i);
          const roomsFromSlug = hrefAttr.match(/-t(\d\+?)-/i);
          const rooms = roomsFromTitle
            ? roomsFromTitle[0].toUpperCase()
            : roomsFromSlug
              ? `T${roomsFromSlug[1]}`
              : "";

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
      { source: this.name, type: propertyType, baseUrl: this.baseUrl, typeToken }
    );

    return listings;
  }

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
        "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
        "#onetrust-accept-btn-handler",
        '#didomi-notice-agree-button',
        'button:has-text("Aceitar")',
        'button:has-text("Permitir tudo")',
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
