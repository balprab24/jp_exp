#!/usr/bin/env node
// Reads data/clover-export.xlsx (exported from the Clover dashboard),
// joins items with their categories, and writes the result into
// data/inventory.json's `fullInventory` array. Preserves hotItems,
// newListings, deals, and storeInfo.
//
// The Clover export has a multi-sheet structure:
//   - "Items" sheet: one row per item (Clover ID, Name, Description, Price, ...)
//   - "Categories" sheet: forward-filled mapping of item name → category
//     (Category Name appears only on the first row of each category group)
//
// Usage:
//   npm run sync                 write the real file
//   npm run sync -- --dry-run    preview without writing

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const { curateItem } = require('./curation');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.join(__dirname, '..');
const EXPORT_PATH = path.join(ROOT, 'data', 'clover-export.xlsx');
const INVENTORY_PATH = path.join(ROOT, 'data', 'inventory.json');
const CATEGORY_MAP_PATH = path.join(__dirname, 'category-map.json');

// Header aliases for the Items sheet (case-insensitive).
const COLUMN_ALIASES = {
  id: ['clover id', 'id'],
  name: ['name', 'item name', 'product name'],
  description: ['description', 'desc'],
  price: ['price', 'unit price', 'retail price'],
  stock: ['quantity', 'stock count', 'quantity on hand', 'on hand', 'qty', 'qty on hand'],
  hidden: ['hidden?', 'hidden', 'non-revenue item', 'non revenue item'],
  sku: ['sku', 'item code', 'product code'],
};
const REQUIRED = ['name', 'price'];

function die(msg) {
  console.error(`[sync] ${msg}`);
  process.exit(1);
}

function detectColumns(headerRow) {
  const normalized = headerRow.map(h => (h == null ? '' : String(h).trim().toLowerCase()));
  const mapping = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx !== -1) mapping[field] = idx;
  }
  return mapping;
}

// Sub-classification of generic "Liquor" items by brand keywords in the item name.
// First match wins. Unknown brands stay as "Liquor".
const LIQUOR_BRAND_KEYWORDS = {
  Cognac: ['hennessy', 'remy martin', 'rémy', 'remy', 'courvoisier', 'martell', "d'usse", 'dusse', 'hardy', 'camus', 'otard', 'cognac'],
  Tequila: ['patron', 'patrón', 'don julio', 'casamigos', 'clase azul', '1800', 'cazadores', 'hornitos', 'sauza', 'jose cuervo', 'cuervo', 'espolon', 'espolòn', 'avion', 'herradura', 'el jimador', 'milagro', 'tres generaciones', 'tequila', 'mezcal'],
  Whiskey: ['jack daniel', 'crown royal', 'buchanan', 'johnnie walker', 'jameson', 'jim beam', 'bulleit', "maker's mark", 'makers mark', 'wild turkey', 'knob creek', 'woodford', 'glenfiddich', 'glenlivet', 'macallan', 'chivas', 'dewar', 'fireball', 'skrewball', 'pendleton', 'evan williams', 'old grand', 'old crow', 'black velvet', 'canadian club', 'seagram', 'whiskey', 'whisky', 'bourbon', 'scotch', 'rye'],
  Vodka: ['tito', 'grey goose', 'smirnoff', 'absolut', 'stoli', 'stolichnaya', 'ciroc', 'belvedere', 'new amsterdam', 'amsterdam', 'svedka', 'pinnacle', 'three olives', 'ketel one', 'pinkwhitney', 'pink whitney', "burnett", 'skyy', 'platinum 7x', 'vodka'],
  Rum: ['bacardi', 'captain morgan', 'malibu', 'kraken', 'mount gay', 'gosling', 'don q', 'sailor jerry', 'myers', 'appleton', 'rum'],
};

function subClassifyLiquor(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(LIQUOR_BRAND_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat;
    }
  }
  return 'Liquor';
}

const SIZE_RE = /(\d+(?:\.\d+)?)\s?(ml|l|oz|pk|pack|g)\b/i;
function extractSize(...sources) {
  for (const src of sources) {
    if (!src) continue;
    const m = String(src).match(SIZE_RE);
    if (m) {
      const unit = m[2].toLowerCase();
      const normalized = unit === 'l' ? 'L' : unit === 'pack' ? 'Pack' : unit;
      return `${m[1]}${normalized}`;
    }
  }
  return '';
}

function parsePrice(raw) {
  if (typeof raw === 'number') return +raw.toFixed(2);
  if (raw == null) return 0;
  const cleaned = String(raw).replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? +n.toFixed(2) : 0;
}

function isTruthyFlag(raw) {
  if (raw == null || raw === '') return false;
  const s = String(raw).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

function parseStock(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildCategoryLookup(categoriesSheet) {
  // Sheet shape: ["Category ID", "Category Name", "Subcategory Name", "Item Sort Order"]
  // Forward-fill: Category Name only appears on the first row of each group.
  // The "Item Sort Order" column actually contains the item name.
  const rows = XLSX.utils.sheet_to_json(categoriesSheet, { header: 1, defval: '', blankrows: false });
  const lookup = new Map();
  let currentCategory = '';
  for (let i = 1; i < rows.length; i++) {
    const cat = String(rows[i][1] || '').trim();
    const itemName = String(rows[i][3] || '').trim();
    if (cat) currentCategory = cat;
    if (itemName && currentCategory) {
      // Use first occurrence; if same item appears under multiple categories, keep the first.
      if (!lookup.has(itemName.toLowerCase())) {
        lookup.set(itemName.toLowerCase(), currentCategory);
      }
    }
  }
  return lookup;
}

function mapCategory(rawCategory, categoryMap, unmappedSet) {
  if (!rawCategory) return 'Other';
  const trimmed = String(rawCategory).trim();
  if (!trimmed) return 'Other';
  if (categoryMap[trimmed]) return categoryMap[trimmed];
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(categoryMap)) {
    if (key.toLowerCase() === lower) return val;
  }
  unmappedSet.add(trimmed);
  return 'Other';
}

function main() {
  if (!fs.existsSync(EXPORT_PATH)) {
    die(`no export file found at ${EXPORT_PATH}\n      Export from Clover dashboard → Inventory → Items → Export, then save the .xlsx here.`);
  }

  const workbook = XLSX.readFile(EXPORT_PATH);
  const itemsSheet = workbook.Sheets['Items'];
  if (!itemsSheet) {
    die(`no "Items" sheet found in workbook. Sheets present: ${workbook.SheetNames.join(', ')}`);
  }

  const itemsRows = XLSX.utils.sheet_to_json(itemsSheet, { header: 1, defval: '', blankrows: false });
  if (itemsRows.length < 2) die('Items sheet has no data rows');

  const headerRow = itemsRows[0];
  const dataRows = itemsRows.slice(1);
  const cols = detectColumns(headerRow);

  console.log(`[sync] Items sheet: ${dataRows.length} rows`);
  console.log(`[sync] detected columns:`);
  for (const field of Object.keys(COLUMN_ALIASES)) {
    const idx = cols[field];
    console.log(`        ${field.padEnd(11)} → ${idx === undefined ? '(not found)' : `"${headerRow[idx]}"`}`);
  }

  const missing = REQUIRED.filter(f => cols[f] === undefined);
  if (missing.length) {
    die(
      `missing required column(s): ${missing.join(', ')}\n` +
      `      file headers were: ${headerRow.map(h => `"${h}"`).join(', ')}`
    );
  }

  // Build name → category lookup from Categories sheet (if present).
  let categoryLookup = new Map();
  if (workbook.Sheets['Categories']) {
    categoryLookup = buildCategoryLookup(workbook.Sheets['Categories']);
    console.log(`[sync] Categories sheet: ${categoryLookup.size} item-to-category links`);
  } else {
    console.log(`[sync] no "Categories" sheet found — all items will fall through to "Other"`);
  }

  const categoryMap = JSON.parse(fs.readFileSync(CATEGORY_MAP_PATH, 'utf8'));
  const unmapped = new Set();
  const hasStockColumn = cols.stock !== undefined;

  const mapped = [];
  let skippedHidden = 0;
  let skippedNoName = 0;
  let skippedPlaceholder = 0;
  let skippedZeroPrice = 0;
  let skippedJunkName = 0;

  for (const row of dataRows) {
    const name = String(row[cols.name] ?? '').trim();
    if (!name) { skippedNoName++; continue; }
    if (cols.hidden !== undefined && isTruthyFlag(row[cols.hidden])) { skippedHidden++; continue; }
    // POS custom-amount placeholders are named like "*Custom Beer", "* Custom Snack", etc.
    if (/^\*\s*custom/i.test(name)) { skippedPlaceholder++; continue; }
    // Junk entries that look like POS shorthand rather than real products:
    //   - starts with a digit followed by a unit/word ("15 alum 16oz", "30 pk", "99 Apples")
    //   - contains a URL (QR-code artifacts)
    //   - very short or all-numeric names ("00441")
    if (/^\d+\s+\w/.test(name)) { skippedJunkName++; continue; }
    if (/https?:\/\//i.test(name)) { skippedJunkName++; continue; }
    if (name.length < 3 || /^\d+$/.test(name)) { skippedJunkName++; continue; }
    const price = parsePrice(row[cols.price]);
    if (price <= 0) { skippedZeroPrice++; continue; }

    const description = cols.description !== undefined ? String(row[cols.description] ?? '').trim() : '';
    const stockCount = hasStockColumn ? parseStock(row[cols.stock]) : null;
    const inStock = hasStockColumn ? (stockCount !== null ? stockCount > 0 : true) : true;

    const rawCategory = categoryLookup.get(name.toLowerCase()) || '';
    let category = mapCategory(rawCategory, categoryMap, unmapped);

    // Skip items that don't fit the site (grocery/lottery/POS placeholders → "Other").
    if (category === 'Other') continue;

    // Sub-classify generic Liquor by brand keyword.
    if (category === 'Liquor') category = subClassifyLiquor(name);

    mapped.push({
      id: cols.id !== undefined ? String(row[cols.id] ?? '').trim() || name : name,
      name,
      category,
      size: extractSize(name, description),
      price,
      inStock,
    });
  }

  // Dedupe on (normalized name + normalized size). Data-entry errors in Clover
  // tend to create duplicate rows with varying prices — usually one is legit,
  // the other is wrong (often $0 or wildly off). Keep the highest-priced entry
  // per group as the more likely correct one, and warn loudly on conflicts so
  // the user can fix them in the POS over time.
  const normKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const groups = new Map();
  for (const item of mapped) {
    const key = normKey(item.name) + '|' + normKey(item.size);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const deduped = [];
  const priceConflicts = [];
  let mergedGroups = 0;
  let removedItems = 0;
  for (const group of groups.values()) {
    if (group.length === 1) { deduped.push(group[0]); continue; }
    mergedGroups++;
    removedItems += group.length - 1;
    // Pick the item with the highest price; tie-broken by first occurrence.
    const winner = group.reduce((a, b) => (b.price > a.price ? b : a));
    deduped.push(winner);
    // Flag as a price conflict if the prices differ meaningfully (>1 cent).
    const prices = group.map(g => g.price);
    const maxP = Math.max(...prices), minP = Math.min(...prices);
    if (maxP - minP > 0.01) {
      priceConflicts.push({ name: winner.name, size: winner.size, prices });
    }
  }

  // Curate: rewrite brand misspellings, re-tag mis-categorized spirit items,
  // and drop items in spirit categories that don't match a curated main brand.
  // See scripts/curation.js. Non-spirit categories pass through unchanged.
  const curated = [];
  let droppedByCuration = 0;
  for (const item of deduped) {
    const result = curateItem(item);
    if (result === null) droppedByCuration++;
    else curated.push(result);
  }

  curated.sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  );

  // Per-category counts
  const counts = {};
  for (const item of curated) counts[item.category] = (counts[item.category] || 0) + 1;
  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  console.log(`\n[sync] mapped ${mapped.length} items (skipped ${skippedHidden} hidden, ${skippedNoName} unnamed, ${skippedPlaceholder} POS placeholders, ${skippedZeroPrice} zero-price, ${skippedJunkName} junk names)`);
  console.log(`[sync] deduped: merged ${mergedGroups} duplicate group${mergedGroups === 1 ? '' : 's'} (removed ${removedItems} item${removedItems === 1 ? '' : 's'}) → ${deduped.length} items`);
  console.log(`[sync] curation dropped ${droppedByCuration} non-brand / invalid-size spirit item${droppedByCuration === 1 ? '' : 's'} → ${curated.length} final items`);
  console.log(`[sync] items per site category:`);
  for (const [cat, n] of sortedCounts) {
    console.log(`        ${String(n).padStart(5)}  ${cat}`);
  }

  if (unmapped.size > 0) {
    console.log(`\n[sync] WARNING: ${unmapped.size} unmapped Clover categor${unmapped.size === 1 ? 'y' : 'ies'} (fell back to "Other"):`);
    for (const c of [...unmapped].sort()) console.log(`        - "${c}"`);
    console.log(`        add these to scripts/category-map.json if you want them under a specific site category.`);
  }

  if (priceConflicts.length > 0) {
    console.log(`\n[sync] WARNING: ${priceConflicts.length} duplicate item${priceConflicts.length === 1 ? '' : 's'} had conflicting prices in Clover (kept the highest). Fix these in your POS:`);
    for (const c of priceConflicts.slice(0, 15)) {
      const priceStr = c.prices.map(p => `$${p.toFixed(2)}`).join(', ');
      console.log(`        - "${c.name}"${c.size ? ` (${c.size})` : ''}: ${priceStr}`);
    }
    if (priceConflicts.length > 15) console.log(`        … and ${priceConflicts.length - 15} more.`);
  }

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  const previousCount = Array.isArray(inventory.fullInventory) ? inventory.fullInventory.length : 0;
  inventory.fullInventory = curated;

  if (DRY_RUN) {
    console.log(`\n[sync] DRY RUN — would replace ${previousCount} items with ${curated.length}`);
    console.log(`[sync] first 3 mapped items:`);
    console.log(JSON.stringify(curated.slice(0, 3), null, 2));
    return;
  }

  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2) + '\n');
  console.log(`\n[sync] wrote ${INVENTORY_PATH} (${previousCount} → ${curated.length} items)`);
}

main();
