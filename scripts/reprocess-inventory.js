#!/usr/bin/env node
// One-time pass over data/inventory.json — applies scripts/curation.js to the
// already-committed data. Useful when you don't have data/clover-export.xlsx
// locally (e.g. CI, fresh clone) but still want to re-curate after editing
// CURATED_BRANDS or BRAND_ALIASES.
//
// For a full re-import from the Clover XLSX, use `npm run sync` instead.
//
// Usage:
//   npm run sync:reprocess              write the file
//   npm run sync:reprocess -- --dry-run preview counts only

const fs = require('node:fs');
const path = require('node:path');
const { curateItem } = require('./curation');

const DRY_RUN = process.argv.includes('--dry-run');
const INVENTORY_PATH = path.join(__dirname, '..', 'data', 'inventory.json');

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
const before = Array.isArray(inventory.fullInventory) ? inventory.fullInventory : [];

const curated = [];
let dropped = 0;
const droppedSamples = [];
for (const item of before) {
  const result = curateItem(item);
  if (result === null) {
    dropped++;
    if (droppedSamples.length < 15) droppedSamples.push(item);
  } else {
    curated.push(result);
  }
}

curated.sort((a, b) =>
  a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
);

const countsBefore = {};
for (const i of before) countsBefore[i.category] = (countsBefore[i.category] || 0) + 1;
const countsAfter = {};
for (const i of curated) countsAfter[i.category] = (countsAfter[i.category] || 0) + 1;

console.log(`[reprocess] ${before.length} → ${curated.length} items (${dropped} dropped)`);
console.log(`[reprocess] per-category change:`);
const cats = [...new Set([...Object.keys(countsBefore), ...Object.keys(countsAfter)])].sort();
for (const cat of cats) {
  const b = countsBefore[cat] || 0;
  const a = countsAfter[cat] || 0;
  const delta = a - b;
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  console.log(`        ${cat.padEnd(10)} ${String(b).padStart(5)} → ${String(a).padStart(5)}  (${sign})`);
}

if (droppedSamples.length > 0) {
  console.log(`\n[reprocess] sample dropped items (first ${droppedSamples.length}):`);
  for (const s of droppedSamples) {
    console.log(`        - [${s.category}] "${s.name}" size="${s.size}" price=$${s.price}`);
  }
}

if (DRY_RUN) {
  console.log(`\n[reprocess] DRY RUN — no changes written`);
  process.exit(0);
}

inventory.fullInventory = curated;
fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2) + '\n');
console.log(`\n[reprocess] wrote ${INVENTORY_PATH}`);
