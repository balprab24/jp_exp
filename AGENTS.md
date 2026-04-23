# AGENTS.md

@.claude/rules/workflow.md

@.claude/rules/technical-defaults.md

@.claude/rules/design-fidelity.md

@.claude/rules/deploy.md

## Project Overview
- **Project:** Express Liquor & Tobacco — a static storefront website for a local liquor and tobacco shop, with manual Clover inventory sync
- **Target user:** local shoppers browsing products and store information online
- **My skill level:** intermediate
- **Stack:** static HTML, Tailwind CSS via CDN, vanilla JavaScript, GitHub Pages, Node.js scripts for inventory sync

## Commands
- **Install:** `npm install`
- **Dev:** no dev server is configured; open `index.html` directly or use `python3 -m http.server 8000`
- **Build:** no build step is required for the site
- **Test:** no automated test suite is configured
- **Lint:** no lint command is configured
- **Inventory sync:** `npm run sync -- --dry-run` to preview, then `npm run sync`
- **Screenshot check:** `npx puppeteer screenshot index.html --fullpage`

## Do
- Read the existing HTML, CSS, and scripts before changing anything
- Match the current structure, naming, and visual style unless the user asks for a redesign
- Keep the site as a single-page static app unless the user asks for a different structure
- Use Tailwind via CDN and keep markup inline unless the user requests a different setup
- Handle empty, missing, or malformed inventory data gracefully
- Keep changes small, scoped, and easy to review
- Verify the page in a browser or with a screenshot pass after changes
- For design recreation work, compare against the reference image for at least two rounds
- Ask before making risky assumptions that could change content, data shape, or deployment behavior

## Don't
- Install new dependencies without asking first
- Delete or overwrite user work without confirming
- Hardcode secrets, API keys, or credentials
- Rewrite working sections just to make them look cleaner
- Change deployment behavior, GitHub Pages settings, or inventory schema without a clear reason
- Push, deploy, or force-push without permission
- Make changes outside the user’s request

## When Stuck
- Break large tasks into smaller steps and confirm the direction before a big rewrite
- If a fix fails twice, stop, summarize what was tried, and explain the blocker
- If inventory data looks wrong, inspect `data/inventory.json`, `scripts/category-map.json`, and `scripts/sync-inventory.js` before changing the UI

## Testing
- If no automated tests exist, do a manual verification pass after every change
- For UI changes, reload the page and check layout, spacing, and responsive behavior
- For inventory changes, run `npm run sync -- --dry-run` before the real sync when possible
- Do not skip validation just because the project is static

## Git
- Keep commits focused and descriptive
- Never force push
- Do not revert unrelated local changes

## Response Style
- Always respond with clear and concise messages
- Use plain English when explaining technical changes
- Avoid long sentences, complex wording, and long paragraphs
- Surface assumptions explicitly when repo context is incomplete

## Project Notes
- Deployment is handled by GitHub Pages through `.github/workflows/deploy.yml`
- Inventory exports come from Clover as a local XLSX file and are converted into `data/inventory.json`
- The raw Clover export should stay local and uncommitted
- If category mappings change, update `scripts/category-map.json`
