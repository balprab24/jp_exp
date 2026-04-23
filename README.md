<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111827" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/GitHub_Pages-121013?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages" />
</p>

# Express Liquor & Tobacco

A polished, inventory-aware storefront for an independent retail shop.

This project is a static site built for GitHub Pages, with a manual Clover export workflow that turns a spreadsheet into a searchable online inventory. The goal is simple: make the site feel modern, fast, and easy to browse without introducing a heavy app stack.

## What This Repo Does

- Presents a branded one-page storefront in `index.html`
- Loads live inventory from `data/inventory.json`
- Highlights curated sections like hot items, deals, and new listings
- Supports search and category-based browsing on the page
- Lets the owner refresh inventory from a Clover `.xlsx` export
- Deploys automatically to GitHub Pages on every push to `main`

## Why It Exists

Many small retail shops do not need a giant ecommerce platform to look legitimate online. They need:

- a clean homepage
- accurate product listings
- simple updates
- a workflow that is realistic for the store owner

This repo is built around that idea.

## Stack

- HTML
- Tailwind CSS via CDN
- Vanilla JavaScript
- Node.js for inventory sync scripts
- `xlsx` for reading Clover exports
- `puppeteer` for screenshot-based verification
- GitHub Actions for deployment

## Project Structure

```text
.
├── index.html                 # Main site
├── styles.css                 # Extra styling
├── data/
│   ├── inventory.json         # Site content + full inventory
│   └── clover-export.xlsx     # Local-only Clover export, gitignored
├── scripts/
│   ├── sync-inventory.js      # XLSX to inventory JSON sync script
│   ├── reprocess-inventory.js # Re-curate inventory.json without re-importing xlsx
│   ├── curation.js            # Brand whitelist, typo aliases, size normalization
│   └── category-map.json      # Clover category mapping
├── .github/workflows/
│   └── deploy.yml             # GitHub Pages deploy workflow
├── .claude/                   # Claude project instructions
├── AGENTS.md                  # Codex/agent project instructions
└── package.json
```

## Local Setup

Install dependencies:

```bash
npm install
```

Run a simple local server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

There is no framework dev server and no build step. This project is intentionally lightweight.

## Inventory Workflow

The project uses Clover Essentials, so inventory updates are done through export files instead of a live API.

### 1. Export from Clover

In Clover:

```text
Inventory -> Items -> Export
```

Save the exported file here:

```text
data/clover-export.xlsx
```

This file is gitignored and should stay local.

### 2. Preview the sync

```bash
npm run sync -- --dry-run
```

This prints:

- detected columns
- number of rows found
- mapped inventory preview
- warnings for unmapped categories

### 3. Run the real sync

```bash
npm run sync
```

This updates `data/inventory.json`, specifically the `fullInventory` array, while preserving:

- `hotItems`
- `newListings`
- `deals`
- `storeInfo`

### 4. Review the diff

Check the generated changes before committing:

```bash
git diff data/inventory.json
```

### 5. Re-curate without re-importing

If you only change the curation rules (`scripts/curation.js` — brand whitelist, typo aliases, size normalization) and want to apply them to the already-committed `inventory.json` without needing the original `.xlsx`:

```bash
npm run sync:reprocess -- --dry-run   # preview the drops / category moves
npm run sync:reprocess                # write it
```

## Curation

Both `sync` and `sync:reprocess` pipe every item through `scripts/curation.js`, which does three things:

- **Brand aliases** — canonicalize common misspellings (`Hennesy → Hennessy`, `Crow Royal → Crown Royal`, `Caymanjack → Cayman Jack`, etc.). See `BRAND_ALIASES`.
- **Category re-tagging** — move mis-categorized items based on the brand in the name (e.g. `Hennesy VS 100 ml` tagged Liquor in Clover → Cognac).
- **Main-brand whitelist** — drop items whose name doesn't match a curated brand for their category. See `CURATED_BRANDS`. Keeps employee-shorthand junk out of the grid.

When adding a new brand to the whitelist, also add it to `CATEGORY_BRANDS` in `index.html` so the brand-checkbox UI picks it up.

## Data Model

The main inventory payload in `data/inventory.json` uses this shape:

```json
{
  "id": "ITEM_ID",
  "name": "Product Name",
  "category": "Tequila",
  "size": "750ml",
  "price": 29.99,
  "inStock": true
}
```

The same JSON file also holds curated content for homepage sections:

- `hotItems`
- `newListings`
- `deals`
- `storeInfo`

That split is intentional:

- `fullInventory` is generated from Clover
- featured content is edited manually

## Deployment

Deployment is handled by GitHub Actions through `.github/workflows/deploy.yml`.

On every push to `main`, the site is published to GitHub Pages.

To make deployment work in GitHub repo settings:

```text
Settings -> Pages -> Source: GitHub Actions
```

## Design Notes

The site is meant to feel more premium than a typical small-business landing page. The current direction uses:

- dark, high-contrast visuals
- neon-purple glow accents
- bold category browsing
- a single long-form landing page
- quick inventory search without leaving the page

It is a static site, but it should not feel like a plain static site.

## Commands

```bash
npm install
npm run sync -- --dry-run
npm run sync
npm run sync:reprocess -- --dry-run
npm run sync:reprocess
npx puppeteer screenshot index.html --fullpage
python3 -m http.server 8000
```

## Current Limitations

- No automated test suite is set up yet
- No lint command is configured yet
- Inventory updates are manual, not real-time
- Some homepage content is curated manually instead of generated from store data

## Good Future Upgrades

- Add a proper local preview command
- Add lightweight automated checks for JSON shape
- Add image handling for inventory items
- Improve category coverage as Clover data evolves
- Add better mobile QA snapshots

## For Collaborators

If you are editing this repo:

- read `AGENTS.md` for agent instructions
- read `.claude/CLAUDE.md` for Claude-specific project guidance
- keep changes small and scoped
- do not install new dependencies without a reason
- verify the page after UI edits

## Final Thought

This repo is not trying to be a giant platform. It is trying to be dependable, good-looking, and easy to maintain. That constraint is part of the design.
