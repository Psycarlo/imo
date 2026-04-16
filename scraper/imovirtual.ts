import { BaseScraper } from "./base.js";
import type { Listing, ImovirtualFilters } from "./types.js";

export class ImovirtualScraper extends BaseScraper {
  readonly name = "imovirtual";
  readonly baseUrl = "https://www.imovirtual.com";

  private filters: ImovirtualFilters;

  constructor(filters: ImovirtualFilters = {}) {
    super();
    this.filters = {
      transaction: "comprar",
      propertyType: "moradia",
      location: ["leiria", "leiria"],
      ownerType: "ALL",
      ...filters,
    };
  }

  private listingsUrl(page: number): string {
    const { transaction, propertyType, location, priceMin, priceMax, areaMin, areaMax, roomsNumber, ownerType } = this.filters;

    const locationPath = location?.length ? location.join("/") : "todo-o-pais";
    const basePath = `${this.baseUrl}/pt/resultados/${transaction}/${propertyType}/${locationPath}`;

    const params = new URLSearchParams();
    if (ownerType) params.set("ownerTypeSingleSelect", ownerType);
    if (priceMin != null) params.set("priceMin", String(priceMin));
    if (priceMax != null) params.set("priceMax", String(priceMax));
    if (areaMin != null) params.set("areaMin", String(areaMin));
    if (areaMax != null) params.set("areaMax", String(areaMax));
    if (roomsNumber?.length) params.set("roomsNumber", `[${roomsNumber.join(",")}]`);
    params.set("page", String(page));

    return `${basePath}?${params.toString()}`;
  }

  async scrape(maxPages = 3, limit?: number): Promise<Listing[]> {
    let allListings: Listing[] = [];

    for (let page = 1; page <= maxPages; page++) {
      console.log(`[${this.name}] Scraping page ${page}/${maxPages}...`);

      try {
        const listings = await this.scrapePage(page);

        if (listings.length === 0) {
          console.log(`[${this.name}] No listings found on page ${page}, stopping.`);
          break;
        }

        allListings.push(...listings);
        console.log(`[${this.name}] Got ${listings.length} listings from page ${page} (total: ${allListings.length})`);

        // Stop paging early if we already have enough
        if (limit != null && allListings.length >= limit) break;
      } catch (err) {
        console.error(`[${this.name}] Failed on page ${page}:`, (err as Error).message);
        break;
      }

      if (page < maxPages) {
        await this.page.waitForTimeout(1500 + Math.random() * 1500);
      }
    }

    // Apply limit before phone scraping
    if (limit != null && allListings.length > limit) {
      console.log(`[${this.name}] Trimming from ${allListings.length} to ${limit}`);
      allListings = allListings.slice(0, limit);
    }

    // Scrape phone numbers by visiting each listing detail page
    console.log(`[${this.name}] Scraping phone numbers for ${allListings.length} listings...`);
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
      // Small delay between detail page visits
      await this.page.waitForTimeout(800 + Math.random() * 1200);
    }

    return allListings;
  }

  private async scrapePage(pageNum: number): Promise<Listing[]> {
    await this.page.goto(this.listingsUrl(pageNum), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Dismiss cookie consent if present (only matters on first page)
    if (pageNum === 1) await this.dismissCookies();

    // Wait for listing cards to render
    await this.page.waitForSelector('article[data-sentry-component="AdvertCard"]', {
      timeout: 15000,
    });
    // Small extra wait for all cards to finish rendering
    await this.page.waitForTimeout(1000);

    const propertyType = this.filters.propertyType as "moradia" | "apartamento";

    // Each listing is an <article data-sentry-component="AdvertCard">
    const listings = await this.page.evaluate((args: { source: string; type: "moradia" | "apartamento" }) => {
      const articles = document.querySelectorAll('article[data-sentry-component="AdvertCard"]');
      const results: {
        title: string;
        price: string;
        pricePerM2: string;
        location: string;
        area: string;
        rooms: string;
        url: string;
        source: string;
        type: "moradia" | "apartamento";
      }[] = [];

      for (const article of articles) {
        const text = (article as HTMLElement).innerText || "";
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // Get the listing URL from the first link with /pt/anuncio/
        const link = article.querySelector('a[href*="/pt/anuncio/"]') as HTMLAnchorElement | null;
        if (!link) continue;

        // Price: a line that is purely "digits/spaces €" (not €/m²)
        const priceLine = lines.find((l) => /^\d[\d\s]*€$/.test(l));
        const price = priceLine || "";

        // Price per m²
        const pricePerM2Line = lines.find((l) => /€\/m²/.test(l));
        const pricePerM2 = pricePerM2Line || "";

        // Rooms: after "Tipologia" line, the next line is T0-T5+
        const tipoIdx = lines.findIndex((l) => l === "Tipologia");
        const rooms = tipoIdx >= 0 && tipoIdx + 1 < lines.length ? lines[tipoIdx + 1] : "";

        // Area: line with m² that's NOT price/m² (appears after "Preço por metro quadrado")
        const precoIdx = lines.findIndex((l) => l.includes("Preço por metro quadrado"));
        const area = precoIdx >= 0 && precoIdx + 1 < lines.length ? lines[precoIdx + 1] : "";

        // Noise patterns to skip
        const noisePatterns = [
          /^\d[\d\s]*€/,
          /^\d+\s*\/\s*\d+$/,
          /€\/m²/,
          /^Tipologia$/,
          /Preço por metro/,
          /Ver descrição/,
          /Profissional/,
          /Particular/,
          /Destacado/,
          /Oferta privada/,
          /^Adicionado/,
          /^Todos os anúncios$/,
          /^Gostaria de saber/,
          /^T\d\+?$/,
          /^\d[\d\s.,]*m²$/,
        ];

        // Title: first meaningful line > 10 chars, fallback to URL slug
        const slugTitle = link.href
          .split("/").pop()?.replace(/-ID\w+$/, "").replace(/-/g, " ") || "";
        const title =
          lines.find(
            (l) => l.length > 10 && !noisePatterns.some((p) => p.test(l))
          ) || slugTitle;

        // Location: first line after the title that contains a comma
        const titleIdx = title ? lines.indexOf(title) : -1;
        const location =
          lines.find(
            (l, i) =>
              i > titleIdx &&
              l.includes(",") &&
              !noisePatterns.some((p) => p.test(l)) &&
              l.length > 5
          ) || "";

        results.push({
          title,
          price,
          pricePerM2,
          location,
          area,
          rooms,
          url: link.href,
          source: args.source,
          type: args.type,
        });
      }

      return results;
    }, { source: this.name, type: propertyType });

    return listings;
  }

  private async scrapePhone(listingUrl: string): Promise<string | undefined> {
    await this.page.goto(listingUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Dismiss cookie consent if it appears on detail page
    await this.dismissCookies();

    // Look for "Mostrar número" button (may be multiple on page, take first)
    const showPhoneBtn = this.page.locator(
      'button[data-cy="phone-number.show-full-number-button"]'
    ).first();

    if ((await showPhoneBtn.count()) === 0) return undefined;

    await showPhoneBtn.click({ timeout: 5000 });

    // Wait for phone number to appear — it replaces the button or appears nearby
    // The revealed number typically appears in an <a href="tel:..."> or text near the button
    await this.page.waitForTimeout(1500);

    // Try to find phone in tel: link first
    const telLink = this.page.locator('a[href^="tel:"]').first();
    if ((await telLink.count()) > 0) {
      const href = await telLink.getAttribute("href");
      if (href) return href.replace("tel:", "").trim();
    }

    // Fallback: look for phone number text in the phone section
    const phoneSection = this.page.locator(
      '[data-cy="phone-number.show-full-number-button"]'
    ).locator("..");
    const phoneText = await phoneSection.innerText().catch(() => "");
    const phoneMatch = phoneText.match(/[\d\s+()-]{9,}/);
    if (phoneMatch) return phoneMatch[0].trim();

    return undefined;
  }

  private async dismissCookies(): Promise<void> {
    try {
      const selectors = [
        '#onetrust-accept-btn-handler',
        'button[id*="accept"]',
        'button[id*="consent"]',
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
      // No cookie banner
    }
  }
}
