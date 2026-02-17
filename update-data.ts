const REFURB_URL = "https://www.apple.com/shop/refurbished/mac/mac-mini";

interface Offer {
  price?: string | number;
  priceCurrency?: string;
}

interface Product {
  "@type"?: string;
  name?: string;
  description?: string;
  sku?: string;
  offers?: Offer | Offer[];
}

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
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.text();
}

function extractJsonLd(html: string): Product[] {
  const pattern = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  const products: Product[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "Product" && item.name && /mac\s*mini/i.test(item.name)) {
          products.push(item);
        }
      }
    } catch { /* skip malformed JSON-LD */ }
  }
  return products;
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

function parseSpecs(desc?: string): { ram: string; storage: string; ethernet: string } {
  if (!desc) return { ram: "", storage: "", ethernet: "GbE" };
  const cleaned = desc.replace(/Originally released\s+\w+\s+\d{4}/, "");
  const mem = cleaned.match(/(\d+)\s*GB\s*unified\s*memory/i);
  const ram = mem ? `${mem[1]}GB` : "";
  const stor = cleaned.match(/(\d+\s*[GT]B)\s*SSD/i);
  const storage = stor ? stor[1].replace(/\s+/g, "") : "";
  const eth = /10\s*Gigabit\s*Ethernet/i.test(cleaned) ? "10GbE" : "GbE";
  return { ram, storage, ethernet: eth };
}

function getPrice(product: Product): number | null {
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  if (offer?.price == null) return null;
  return Number(offer.price);
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
  // Skip duplicate if same date already recorded
  if (last?.date === date) {
    last.price = price;
  } else {
    entry.sightings.push({ date, price });
  }
  entry.lastSeen = date;
  entry.refurbPrice = price;
}

async function main() {
  const dataPath = new URL("./data/refurb-history.json", import.meta.url).pathname;
  const today = new Date().toISOString().slice(0, 10);

  // Load existing history
  let history: HistoryFile;
  try {
    history = JSON.parse(await Bun.file(dataPath).text());
  } catch {
    history = { collectedAt: today, source: "apple.com/shop/refurbished", products: [] };
  }

  // Build lookup by ref, migrating legacy entries
  const byRef = new Map<string, HistoryEntry>();
  for (const p of history.products) {
    migrateEntry(p);
    byRef.set(p.ref, p);
  }

  // Scrape Apple refurbished Mac Mini page
  console.log("Fetching Apple refurbished Mac Mini page...");
  const html = await fetchPage(REFURB_URL);
  const products = extractJsonLd(html);
  console.log(`Found ${products.length} Mac Mini(s) currently listed`);

  let added = 0;
  let updated = 0;

  for (const product of products) {
    const ref = product.sku || "";
    if (!ref) continue;
    const { chip, cpuCores, gpuCores } = parseChip(product.name || "");
    const { ram, storage, ethernet } = parseSpecs(product.description);
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
