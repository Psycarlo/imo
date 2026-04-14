import { Browser, chromium, Page } from "playwright";
import type { Listing } from "../types.js";

export abstract class BaseScraper {
  abstract readonly name: string;
  abstract readonly baseUrl: string;

  protected browser!: Browser;
  protected page!: Page;

  async init(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext({
      locale: "pt-PT",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    this.page = await context.newPage();
  }

  abstract scrape(maxPages?: number): Promise<Listing[]>;

  async close(): Promise<void> {
    await this.browser?.close();
  }
}
