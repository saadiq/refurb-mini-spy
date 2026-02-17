import {
  MINI_URL, fetchApplePage, extractMacMiniProducts,
  getPrice, parseSpecsStructured, type Product,
} from "./lib/scrape";

interface Sighting {
  date: string;
  price: number;
}

interface HistoryEntry {
  ref: string;
  chip: string;
  cpuCores: number;
  gpuCores: number;
  ram: string;
  storage: string;
  ethernet: string;
  refurbPrice: number;
  retailPrice: number | null;
  discount: number | null;
  firstSeen: string;
  lastSeen: string;
  sightings: Sighting[];
}

interface HistoryFile {
  collectedAt: string;
  source: string;
  products: HistoryEntry[];
  [key: string]: unknown; // allow deleting legacy keys
}

const CHIP_PATTERNS: Array<[string, RegExp]> = [
  ["M4 Pro", /M4\s*Pro.*?(\d+).core CPU.*?(\d+).core GPU/i],
  ["M4",     /M4.*?(\d+).core CPU.*?(\d+).core GPU/i],
  ["M2 Pro", /M2\s*Pro.*?(\d+).core CPU.*?(\d+).core GPU/i],
  ["M2",     /M2.*?(\d+).core CPU.*?(\d+).core GPU/i],
  ["M1",     /M1.*?(\d+).core CPU.*?(\d+).core GPU/i],
];

function parseChip(name: string): { chip: string; cpuCores: number; gpuCores: number } {
  for (const [chip, pattern] of CHIP_PATTERNS) {
    const m = name.match(pattern);
    if (m) return { chip, cpuCores: +m[1], gpuCores: +m[2] };
  }
  return { chip: "Intel", cpuCores: 0, gpuCores: 0 };
}

/** Migrate legacy entries that lack sightings/firstSeen */
function migrateEntry(entry: HistoryEntry): void {
  if (!entry.firstSeen) {
    entry.firstSeen = entry.lastSeen;
  }
  if (!entry.sightings) {
    entry.sightings = [{ date: entry.lastSeen, price: entry.refurbPrice }];
  }
}

function addSighting(entry: HistoryEntry, date: string, price: number): void {
  const last = entry.sightings[entry.sightings.length - 1];
  if (last?.date === date) {
    last.price = price;
  } else {
    entry.sightings.push({ date, price });
  }
  entry.lastSeen = date;
  entry.refurbPrice = price;
}

async function main() {
  const dataPath = import.meta.dir + "/data/refurb-history.json";
  const today = new Date().toISOString().slice(0, 10);

  // Load existing history
  let history: HistoryFile;
  try {
    history = JSON.parse(await Bun.file(dataPath).text());
  } catch {
    history = { collectedAt: today, source: MINI_URL, products: [] };
  }

  // Clean up stale metadata from legacy data
  history.source = MINI_URL;
  delete history.period;

  // Build lookup by ref, migrating legacy entries
  const byRef = new Map<string, HistoryEntry>();
  for (const p of history.products) {
    migrateEntry(p);
    byRef.set(p.ref, p);
  }

  // Scrape Apple refurbished Mac Mini page
  console.log("Fetching Apple refurbished Mac Mini page...");
  const html = await fetchApplePage(MINI_URL);
  const products = extractMacMiniProducts(html);
  console.log(`Found ${products.length} Mac Mini(s) currently listed`);

  let added = 0;
  let updated = 0;

  for (const product of products) {
    const ref = product.sku || "";
    if (!ref) continue;
    const { chip, cpuCores, gpuCores } = parseChip(product.name || "");
    const { ram, storage, ethernet } = parseSpecsStructured(product.description);
    const refurbPrice = getPrice(product);
    if (refurbPrice == null) continue;

    const existing = byRef.get(ref);
    if (existing) {
      addSighting(existing, today, refurbPrice);
      updated++;
    } else {
      const entry: HistoryEntry = {
        ref, chip, cpuCores, gpuCores, ram, storage, ethernet,
        refurbPrice, retailPrice: null, discount: null,
        firstSeen: today, lastSeen: today,
        sightings: [{ date: today, price: refurbPrice }],
      };
      byRef.set(ref, entry);
      added++;
    }
  }

  // Write back sorted by refurbPrice
  const sorted = [...byRef.values()].sort((a, b) => a.refurbPrice - b.refurbPrice);
  history.collectedAt = today;
  history.products = sorted;

  await Bun.write(dataPath, JSON.stringify(history, null, 2) + "\n");
  console.log(`Done: ${updated} updated, ${added} new — ${sorted.length} total products`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
