## Getting Started

### Requirements

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/installation) >= 10

### Setup

```bash
pnpm install
npx playwright install chromium
```

### Run

```bash
pnpm start
```

Scrapes house listings from imovirtual.com (3 pages by default) and exports them to an Excel file named with today's date (e.g. `res/2026-04-14.xlsx`) in the `res/` folder.

To change the number of pages, edit `MAX_PAGES` in `src/index.ts`.

Released under the **MIT** license — see the [LICENSE](LICENSE) file for details.
