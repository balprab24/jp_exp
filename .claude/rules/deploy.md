# Deployment & Inventory Sync

## Host

GitHub Pages. Deployed by `.github/workflows/deploy.yml` on every push to `main`. One-time enable under repo **Settings → Pages → Source: GitHub Actions**. URL: `https://balprab24.github.io/jp_exp/`.

## Inventory sync (manual, driven by Clover XLSX export)

The store is on the Clover Essentials plan (no API access), so inventory updates happen via a manual XLSX export → `npm run sync` → commit.

### Workflow

1. In the Clover dashboard: **Inventory → Items → Export** (produces `.xlsx`).
2. Save the file as `/Users/prabhnoorbal/jp_exp/data/clover-export.xlsx` (overwrites the previous export).
3. Run `npm run sync -- --dry-run` first — prints detected columns, item count, first 3 mapped items, and flags any unmapped categories. Spot-check against the Clover dashboard.
4. Run `npm run sync` for real. Inspect `git diff data/inventory.json`.
5. `git commit` and `git push`. GitHub Pages redeploys automatically.

### Notes

- `data/clover-export.xlsx` is gitignored — raw exports stay local, only the derived `inventory.json` is committed.
- Category mapping lives in `scripts/category-map.json`. If the sync warns about unmapped Clover categories, add entries to that file.
- Header detection is case-insensitive with aliases (`scripts/sync-inventory.js` → `COLUMN_ALIASES`). If Clover changes its export columns, add the new name there.

## One-time cutover (flip the site from the inline inventory array to the JSON fetch)

Current state: `index.html` renders inventory from a hardcoded `inventory` array at `index.html:~1647-1680`. This was kept in place so the site still works before the first real Clover sync.

After the first `npm run sync` has populated `data/inventory.json.fullInventory` with real store data:

1. Delete the hardcoded `const inventory = [ … ]` array in `index.html`.
2. Above `renderInventory(inventory)`, add a fetch that loads `data/inventory.json`, assigns `inventory = data.fullInventory`, then calls `renderInventory(inventory)` and `setupNavSearch()`.
3. Update the hardcoded category filter buttons at `index.html:~1355-1378` if the real category set differs from `Cognac / Tequila / Whiskey / Vodka / Rum / Smokes`.
4. `script.js` is currently unreferenced — safe to delete at cutover time.

## Schema contract (sync script ↔ render code)

Each item in `fullInventory`:

```json
{ "id": "…", "name": "…", "category": "…", "size": "…", "price": 0.00, "inStock": true }
```

The render code at `index.html:renderInventory` treats missing/undefined `inStock` as `true`.
